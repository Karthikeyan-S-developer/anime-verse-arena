import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Timer as TimerIcon, Flame, Home } from "lucide-react";
import { backToLobby, leaveRoom } from "@/lib/room-actions";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];

export function Results({ room, players, playerId }: { room: Room; players: Player[]; playerId: string }) {
  const navigate = useNavigate();
  const me = players.find((p) => p.id === playerId);
  const isHost = me?.is_host ?? false;

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const tie = sorted.length > 1 && sorted[0].score === sorted[1].score;

  const handleRematch = async () => {
    await backToLobby(room.id);
  };
  const handleExit = async () => {
    await leaveRoom(playerId);
    sessionStorage.removeItem(`player_${room.id}`);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen px-3 sm:px-4 py-8 sm:py-12 max-w-4xl mx-auto">
      <div className="text-center mb-6 sm:mb-8 animate-float-up">
        <Trophy className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-accent mb-3" />
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl tracking-widest mb-2">
          {tie ? "DRAW" : "VICTORY"}
        </h1>
        {!tie && (
          <p className="text-lg sm:text-xl">
            <span className="text-primary font-semibold">{winner?.username}</span> wins!
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {sorted.map((p, i) => {
          const totalAnswered = p.correct_count + (p.id === me?.id ? 0 : 0); // we don't track wrongs separately, use correct vs total questions
          const totalQuestions = (room.questions as unknown[])?.length ?? 0;
          const accuracy = totalQuestions > 0 ? Math.round((p.correct_count / totalQuestions) * 100) : 0;
          const avgMs = p.correct_count > 0 ? Math.round(p.total_answer_ms / Math.max(p.correct_count, 1)) : 0;
          return (
            <Card
              key={p.id}
              className={cn(
                "p-6 border-2",
                i === 0 && !tie && !isCoop ? "border-accent bg-accent/5 shadow-glow" : "border-border bg-card"
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center font-display text-2xl",
                  i === 0 && !tie && !isCoop ? "bg-gradient-ember text-primary-foreground" : "bg-secondary"
                )}>
                  {p.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">{p.username}</div>
                  <div className="text-xs uppercase text-muted-foreground tracking-wider">
                    {p.id === playerId ? "You" : "Opponent"}
                  </div>
                </div>
                {i === 0 && !tie && !isCoop && <Trophy className="w-6 h-6 text-accent" />}
              </div>

              <div className="font-display text-5xl text-accent mb-4">{p.score} <span className="text-sm text-muted-foreground">PTS</span></div>

              <div className="space-y-2 text-sm">
                <Stat icon={Target} label="Accuracy" value={`${accuracy}%`} />
                <Stat icon={TimerIcon} label="Avg. Speed" value={`${(avgMs / 1000).toFixed(1)}s`} />
                <Stat icon={Flame} label="Best Streak" value={`${p.streak}x`} />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3">
        {isHost && (
          <Button
            onClick={handleRematch}
            className="flex-1 h-12 bg-gradient-blood text-primary-foreground font-display text-lg tracking-wider"
          >
            REMATCH
          </Button>
        )}
        <Button
          onClick={handleExit}
          variant="outline"
          className="flex-1 h-12 border-border font-display tracking-wider"
        >
          <Home className="w-4 h-4 mr-2" />
          EXIT
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {label}
      </span>
      <span className="text-foreground font-semibold">{value}</span>
    </div>
  );
}
