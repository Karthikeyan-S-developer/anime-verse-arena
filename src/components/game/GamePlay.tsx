import { useEffect, useState, useMemo } from "react";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { calculateScore } from "@/lib/utils";
import { submitAnswer, updatePlayerScore, nextQuestion, finishGame } from "@/lib/room-actions";
import { Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];
type Answer = Database["public"]["Tables"]["answers"]["Row"];

interface Question {
  type: string;
  question: string;
  imageUrl?: string;
  options: string[];
  correctIndex: number;
  hint?: string;
  stats?: { favorites: number; mal_id: number };
}

const QUESTION_DURATION_MS = 15000;
const RAPID_FIRE_TOTAL_MS = 30000;

export function GamePlay({
  room,
  players,
  answers,
  playerId,
}: {
  room: Room;
  players: Player[];
  answers: Answer[];
  playerId: string;
}) {
  const me = players.find((p) => p.id === playerId);
  const opponent = players.find((p) => p.id !== playerId);
  const isHost = me?.is_host ?? false;
  const questions = (room.questions as unknown as Question[]) ?? [];
  const qIdx = room.current_question;
  const question = questions[qIdx];
  const isRapid = room.game_mode === "rapid_fire";

  const startedAt = room.question_started_at ? new Date(room.question_started_at).getTime() : Date.now();
  const duration = isRapid ? RAPID_FIRE_TOTAL_MS : QUESTION_DURATION_MS;

  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Reset per question
  useEffect(() => {
    setSelected(null);
    setRevealed(false);
  }, [qIdx]);

  // Tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - startedAt;
  const remaining = Math.max(0, duration - elapsed);
  const remainingPct = (remaining / duration) * 100;

  const myAnswer = answers.find((a) => a.player_id === playerId && a.question_index === qIdx);
  const opponentAnswered = !!opponent && answers.some((a) => a.player_id === opponent.id && a.question_index === qIdx);

  // Standard answer flow
  const handleAnswer = async (idx: number) => {
    if (!question || myAnswer || selected !== null) return;
    setSelected(idx);
    const isCorrect = idx === question.correctIndex;
    const points = isCorrect ? calculateScore(elapsed, me?.streak ?? 0) : 0;

    await submitAnswer({
      roomId: room.id,
      playerId,
      questionIndex: qIdx,
      answer: String(idx),
      isCorrect,
      pointsEarned: points,
      answerMs: elapsed,
    });
    await updatePlayerScore(playerId, { score: points, streak: 0, correct: isCorrect, answerMs: elapsed });
  };

  // Time up - auto submit empty for non-rapid modes
  useEffect(() => {
    if (isRapid) return;
    if (!question || myAnswer || remaining > 0) return;
    // submit no-answer
    submitAnswer({
      roomId: room.id,
      playerId,
      questionIndex: qIdx,
      answer: "",
      isCorrect: false,
      pointsEarned: 0,
      answerMs: duration,
    }).then(() =>
      updatePlayerScore(playerId, { score: 0, streak: 0, correct: false, answerMs: duration })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, qIdx, myAnswer, isRapid]);

  // Reveal once both answered (or time up). Only host advances.
  const bothAnswered = useMemo(() => {
    if (players.length < 2) return false;
    return players.every((p) => answers.some((a) => a.player_id === p.id && a.question_index === qIdx));
  }, [players, answers, qIdx]);

  useEffect(() => {
    if (bothAnswered && !revealed) setRevealed(true);
  }, [bothAnswered, revealed]);

  // Host advances the question after a small delay once both answered (or time up in non-rapid)
  useEffect(() => {
    if (!isHost) return;
    if (isRapid) return;
    if (!bothAnswered && remaining > 0) return;
    const timer = setTimeout(async () => {
      if (qIdx + 1 >= questions.length) {
        await finishGame(room.id);
      } else {
        await nextQuestion(room.id, qIdx);
      }
    }, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothAnswered, remaining <= 0, qIdx, isHost, isRapid]);

  // Rapid fire: end when global timer expires (host finishes)
  useEffect(() => {
    if (!isRapid || !isHost) return;
    if (remaining > 0) return;
    finishGame(room.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0, isRapid, isHost]);

  // Rapid fire next-question flow per player (independent)
  const [rapidIdx, setRapidIdx] = useState(0);
  const rapidQuestion = isRapid ? questions[rapidIdx % questions.length] : question;
  const handleRapidAnswer = async (idx: number) => {
    if (!rapidQuestion) return;
    const isCorrect = idx === rapidQuestion.correctIndex;
    const points = isCorrect ? 10 : 0;
    await updatePlayerScore(playerId, { score: points, streak: 0, correct: isCorrect, answerMs: 0 });
    setRapidIdx((i) => i + 1);
  };

  if (!question) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading question...</div>;
  }

  // ---------- RAPID FIRE UI ----------
  if (isRapid) {
    const rq = rapidQuestion!;
    return (
      <div className="min-h-screen px-3 sm:px-4 py-4 sm:py-6 max-w-4xl mx-auto">
        <ScoreBar me={me} opponent={opponent} />
        <div className="mb-3 sm:mb-4">
          <div className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground mb-2">
            <span>Rapid Fire</span>
            <span>{(remaining / 1000).toFixed(1)}s</span>
          </div>
          <Progress value={remainingPct} className="h-2" />
        </div>
        <Card className="p-4 sm:p-6 bg-card border-primary/30 shadow-blood mb-4 animate-slash-in">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4 whitespace-pre-line">{rq.question}</h2>
          {rq.imageUrl && (
            <img src={rq.imageUrl} alt="" className="w-full max-w-xs mx-auto rounded mb-4 blur-sm" />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rq.options.map((opt, i) => (
              <Button
                key={i}
                onClick={() => handleRapidAnswer(i)}
                variant="outline"
                className="h-auto py-3 text-left justify-start border-border hover:border-primary hover:bg-primary/10"
              >
                {opt}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // ---------- STANDARD QUIZ UI ----------
  const myCorrect = myAnswer?.is_correct;

  return (
    <div className="min-h-screen px-3 sm:px-4 py-4 sm:py-6 max-w-4xl mx-auto">
      <ScoreBar me={me} opponent={opponent} />

      {/* Progress */}
      <div className="mb-3 sm:mb-4">
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground mb-2">
          <span>
            Question {qIdx + 1} / {questions.length}
          </span>
          <span>{(remaining / 1000).toFixed(1)}s</span>
        </div>
        <Progress value={remainingPct} className="h-2" />
      </div>

      <Card className="p-4 sm:p-6 bg-card border-primary/30 shadow-blood mb-4 animate-slash-in" key={qIdx}>
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4 whitespace-pre-line">{question.question}</h2>
        {question.imageUrl && (
          <img
            src={question.imageUrl}
            alt=""
            className={cn(
              "w-full max-w-xs mx-auto rounded mb-4 transition-all",
              !revealed && "blur-md scale-95",
              revealed && "blur-0 scale-100"
            )}
          />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {question.options.map((opt, i) => {
            const isSelected = selected === i || (myAnswer && Number(myAnswer.answer) === i);
            const isCorrect = i === question.correctIndex;
            const showResult = revealed || myAnswer;
            return (
              <Button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={!!myAnswer || selected !== null}
                variant="outline"
                className={cn(
                  "h-auto py-3 sm:py-4 text-left justify-start whitespace-normal border-2 transition-all text-sm sm:text-base",
                  !showResult && "border-border hover:border-primary hover:bg-primary/10",
                  showResult && isCorrect && "border-success bg-success/20 text-success-foreground",
                  showResult && isSelected && !isCorrect && "border-destructive bg-destructive/20 animate-shake",
                  showResult && !isSelected && !isCorrect && "opacity-50"
                )}
              >
                <span className="font-mono text-xs mr-2 sm:mr-3 text-muted-foreground">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Status */}
      <div className="text-center text-sm">
        {myAnswer && !opponentAnswered && (
          <p className="text-muted-foreground">Waiting for opponent...</p>
        )}
        {revealed && (
          <p className={cn("font-display text-xl tracking-wider", myCorrect ? "text-success" : "text-destructive")}>
            {myCorrect ? "✓ CORRECT" : "✗ MISSED"}
          </p>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ me, opponent }: { me?: Player; opponent?: Player }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4 sm:mb-6">
      <PlayerCard player={me} label="You" mine />
      <PlayerCard player={opponent} label="Opponent" />
    </div>
  );
}

function PlayerCard({ player, label, mine }: { player?: Player; label: string; mine?: boolean }) {
  return (
    <Card className={cn("p-2 sm:p-3 flex items-center gap-2 sm:gap-3", mine ? "border-primary/40" : "border-border")}>
      <div className={cn(
        "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-display text-sm sm:text-base",
        mine ? "bg-gradient-blood text-primary-foreground" : "bg-secondary"
      )}>
        {player?.username?.charAt(0).toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
        <div className="truncate font-semibold text-sm sm:text-base">{player?.username ?? "—"}</div>
      </div>
      <div className="text-right">
        <div className="font-display text-xl sm:text-2xl text-accent leading-none">{player?.score ?? 0}</div>
        {(player?.streak ?? 0) > 1 && (
          <div className="flex items-center gap-1 text-xs text-accent justify-end">
            <Flame className="w-3 h-3" />
            {player?.streak}
          </div>
        )}
      </div>
      {mine && <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />}
    </Card>
  );
}
