import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useRoom } from "@/hooks/use-room";
import { Lobby } from "@/components/game/Lobby";
import { GamePlay } from "@/components/game/GamePlay";
import { Results } from "@/components/game/Results";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/room/$roomId")({
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const { room, players, answers, loading } = useRoom(roomId);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const pid = sessionStorage.getItem(`player_${roomId}`);
    if (!pid) {
      navigate({ to: "/" });
      return;
    }
    setPlayerId(pid);
  }, [roomId, navigate]);

  if (loading || !room || !playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full border-4 border-primary/30 border-t-primary animate-spin mb-4" />
          <p className="text-muted-foreground font-display tracking-widest text-sm sm:text-base">ENTERING ARENA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Toaster theme="dark" />
      {room.status === "lobby" && <Lobby room={room} players={players} playerId={playerId} />}
      {room.status === "playing" && (
        <GamePlay room={room} players={players} answers={answers} playerId={playerId} />
      )}
      {room.status === "finished" && <Results room={room} players={players} playerId={playerId} />}
    </div>
  );
}
