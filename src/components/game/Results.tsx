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
  const isCoop = room.game_mode === "coop";

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const tie = sorted.length > 1 && sorted[0].score === sorted[1].score && sorted.every(p => p.score === sorted[0].score);

  const handleRematch = async () => {
    await backToLobby(room.id);
  };
  const handleExit = async () => {
    await leaveRoom(playerId);
    sessionStorage.removeItem(`player_${room.id}`);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen px-3 sm:px-4 py-8 sm:py-12 max-w-3xl mx-auto">
      <div className="text-center mb-6 sm:mb-8 animate-float-up">
        <Trophy className="w-14 h-14 sm:w-20 sm:h-20 mx-auto text-accent mb-2 sm:mb-3" />
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl tracking-widest mb-2">
          {isCoop ? "MISSION COMPLETE" : tie ? "DRAW" : "LEADERBOARD"}
        </h1>
        {!isCoop && !tie && (
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-ember flex items-center justify-center overflow-hidden">
              {winner?.selected_character ? (
                <img
                  src={(winner.selected_character as any).images.jpg.image_url}
                  alt={(winner.selected_character as any).name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-xl sm:text-2xl text-primary-foreground">
                  {winner?.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg md:text-xl">
              <span className="text-primary font-semibold">{winner?.username}</span> wins!
            </p>
          </div>
        )}
        {isCoop && (
          <p className="text-base sm:text-lg md:text-xl text-accent font-display tracking-wider">
            COMBINED SCORE: {sorted.reduce((s, p) => s + p.score, 0)}
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
                "p-4 sm:p-6 border-2",
                i === 0 && !tie && !isCoop ? "border-accent bg-accent/5 shadow-glow" : "border-border bg-card"
              )}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className={cn(
                  "w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-display text-lg sm:text-2xl flex-shrink-0 overflow-hidden",
                  i === 0 && !tie && !isCoop ? "bg-gradient-ember text-primary-foreground" : "bg-secondary"
                )}>
                  {p.selected_character ? (
                    <img
                      src={p.selected_character.images.jpg.image_url}
                      alt={p.selected_character.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    p.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm sm:text-lg truncate">{p.username}</div>
                  <div className="text-xs uppercase text-muted-foreground tracking-wider truncate">
                    {p.id === playerId ? "You" : `Player ${i + 1}`}
                  </div>
                </div>
                {i === 0 && !tie && !isCoop && <Trophy className="w-4 h-4 sm:w-6 sm:h-6 text-accent flex-shrink-0" />}
              </div>

              <div className="font-display text-3xl sm:text-4xl md:text-5xl text-accent mb-4">{p.score} <span className="text-xs sm:text-sm text-muted-foreground">PTS</span></div>

              <div className="space-y-2 text-xs sm:text-sm">
                <Stat icon={Target} label="Accuracy" value={`${accuracy}%`} />
                <Stat icon={TimerIcon} label="Avg. Speed" value={`${(avgMs / 1000).toFixed(1)}s`} />
                <Stat icon={Flame} label="Best Streak" value={`${p.streak}x`} />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {isHost && (
          <Button
            onClick={handleRematch}
            className="flex-1 h-10 sm:h-12 bg-gradient-blood text-primary-foreground font-display text-sm sm:text-base md:text-lg tracking-wider"
          >
            REMATCH
          </Button>
        )}
        <Button
          onClick={handleExit}
          variant="outline"
          className="flex-1 h-10 sm:h-12 border-border font-display text-sm sm:text-base md:text-lg tracking-wider"
        >
          <Home className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
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
