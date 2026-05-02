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
  const isHost = me?.is_host ?? false;
  const questions = (room.questions as unknown as Question[]) ?? [];
  const qIdx = room.current_question;
  const question = questions[qIdx];
  const isCoop = room.game_mode === "coop";
  const isRapid = room.game_mode === "rapid_fire";
  const isBattleArena = room.game_mode === "battle_arena";

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
  const allOthersAnswered = players.filter(p => p.id !== playerId).every((p) => answers.some((a) => a.player_id === p.id && a.question_index === qIdx));

  // Battle arena: each player picks a character and we compare favorites
  const handleBattleArenaPick = async () => {
    if (!question || myAnswer) return;
    const points = question.stats?.favorites ?? 0;
    await submitAnswer({
      roomId: room.id,
      playerId,
      questionIndex: qIdx,
      answer: question.question,
      isCorrect: false, // resolved at round end
      pointsEarned: points,
      answerMs: elapsed,
    });
  };

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
    if (isBattleArena) {
      handleBattleArenaPick();
      return;
    }
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
  }, [remaining, qIdx, myAnswer, isRapid, isBattleArena]);

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
      <div className="min-h-screen px-3 sm:px-4 py-4 sm:py-6 max-w-3xl mx-auto">
        <ScoreBar me={me} isCoop={isCoop} />
        <div className="mb-3 sm:mb-4">
          <div className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground mb-2 text-center">
            <span>Rapid Fire</span>
            <span>{(remaining / 1000).toFixed(1)}s</span>
          </div>
          <Progress value={remainingPct} className="h-2" />
        </div>
        <Card className="p-4 sm:p-6 bg-card border-primary/30 shadow-blood mb-4 animate-slash-in">
          <h2 className="text-base sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4 whitespace-pre-line">{rq.question}</h2>
          {rq.imageUrl && (
            <img src={rq.imageUrl} alt="" className="w-full max-w-xs mx-auto rounded mb-3 sm:mb-4 blur-sm" />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rq.options.map((opt, i) => (
              <Button
                key={i}
                onClick={() => handleRapidAnswer(i)}
                variant="outline"
                className="h-auto py-2 sm:py-3 text-left justify-start border-border hover:border-primary hover:bg-primary/10 text-sm sm:text-base"
              >
                {opt}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // ---------- BATTLE ARENA UI ----------
  if (isBattleArena) {
    return (
      <div className="min-h-screen px-3 sm:px-4 py-4 sm:py-6 max-w-3xl mx-auto">
        <ScoreBar me={me} isCoop={isCoop} />
        <div className="text-center mb-3 sm:mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Round {qIdx + 1} of {questions.length}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wider mt-1">PICK YOUR FIGHTER</h2>
        </div>
        <Progress value={remainingPct} className="h-2 mb-3 sm:mb-4" />
        <Card className="p-4 sm:p-6 bg-card border-primary/30 shadow-blood">
          <div className="text-center">
            {question.imageUrl && (
              <img src={question.imageUrl} alt="" className="w-32 sm:w-40 h-40 sm:h-56 object-cover mx-auto rounded mb-3" />
            )}
            <div className="font-display text-xl sm:text-2xl mb-1">{question.question}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mb-4">
              Power Level: <span className="text-accent font-semibold">{question.stats?.favorites?.toLocaleString() ?? "?"}</span>
            </div>
            <Button
              onClick={handleBattleArenaPick}
              disabled={!!myAnswer}
              className="bg-gradient-ember text-primary-foreground font-display text-sm sm:text-base tracking-wider"
            >
              {myAnswer ? "PICKED" : "CLAIM THIS FIGHTER"}
            </Button>
            {myAnswer && !allOthersAnswered && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-3">Waiting for other players...</p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ---------- STANDARD QUIZ UI ----------
  const myCorrect = myAnswer?.is_correct;

  return (
    <div className="min-h-screen px-3 sm:px-4 py-4 sm:py-6 max-w-3xl mx-auto">
      <ScoreBar me={me} isCoop={isCoop} />

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
        <h2 className="text-base sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4 whitespace-pre-line">{question.question}</h2>
        {question.imageUrl && (
          <img
            src={question.imageUrl}
            alt=""
            className={cn(
              "w-full max-w-xs mx-auto rounded mb-3 sm:mb-4 transition-all",
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
                  "h-auto py-2 sm:py-4 px-3 sm:px-4 text-left justify-start whitespace-normal border-2 transition-all text-sm sm:text-base",
                  !showResult && "border-border hover:border-primary hover:bg-primary/10",
                  showResult && isCorrect && "border-success bg-success/20 text-success-foreground",
                  showResult && isSelected && !isCorrect && "border-destructive bg-destructive/20 animate-shake",
                  showResult && !isSelected && !isCorrect && "opacity-50"
                )}
              >
                <span className="font-mono text-xs mr-3 text-muted-foreground">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Status */}
      <div className="text-center text-xs sm:text-sm">
        {myAnswer && !allOthersAnswered && (
          <p className="text-muted-foreground">Waiting for other players...</p>
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

function ScoreBar({ me, isCoop }: { me?: Player; isCoop: boolean }) {
  return (
    <div className="flex justify-center mb-6">
      <PlayerCard player={me} label="Your Score" mine />
      {isCoop && (
        <div className="ml-4 text-center font-display tracking-widest text-accent">
          TEAM SCORE: {me?.score ?? 0}
        </div>
      )}
    </div>
  );
}

function PlayerCard({ player, label, mine }: { player?: Player; label: string; mine?: boolean }) {
  return (
    <Card className={cn("p-3 flex items-center gap-3", mine ? "border-primary/40" : "border-border")}>
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center font-display",
        mine ? "bg-gradient-blood text-primary-foreground" : "bg-secondary"
      )}>
        {player?.username?.charAt(0).toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
        <div className="truncate font-semibold">{player?.username ?? "—"}</div>
      </div>
      <div className="text-right">
        <div className="font-display text-2xl text-accent leading-none">{player?.score ?? 0}</div>
        {(player?.streak ?? 0) > 1 && (
          <div className="flex items-center gap-1 text-xs text-accent justify-end">
            <Flame className="w-3 h-3" />
            {player?.streak}
          </div>
        )}
      </div>
      {mine && <Zap className="w-4 h-4 text-primary" />}
    </Card>
  );
}
