import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Crown, Sword, Brain, ImageIcon, FileText, Swords, Timer, Disc3, Users2 } from "lucide-react";
import { toast } from "sonner";
import { startGame, leaveRoom } from "@/lib/room-actions";
import { generateQuestions } from "@/server/questions.functions";
import { useNavigate } from "@tanstack/react-router";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];

const MODES = [
  { id: "quiz", name: "Quiz Battle", icon: Brain, desc: "10 timed trivia questions", count: 10 },
  { id: "guess_character", name: "Guess Character", icon: ImageIcon, desc: "Identify from images", count: 8 },
  { id: "guess_anime", name: "Guess the Anime", icon: FileText, desc: "From plot descriptions", count: 8 },
  { id: "battle_arena", name: "Battle Arena", icon: Swords, desc: "Pick fighters, compare stats", count: 5 },
  { id: "rapid_fire", name: "Rapid Fire", icon: Timer, desc: "30s — answer as many as you can", count: 15 },
  { id: "spin_wheel", name: "Spin the Wheel", icon: Disc3, desc: "Random mode roulette", count: 10 },
  { id: "coop", name: "Co-op Mode", icon: Users2, desc: "Team up, shared score", count: 10 },
] as const;

export function Lobby({ room, players, playerId }: { room: Room; players: Player[]; playerId: string }) {
  const navigate = useNavigate();
  const me = players.find((p) => p.id === playerId);
  const isHost = me?.is_host ?? false;
  const [selectedMode, setSelectedMode] = useState<string>("quiz");
  const [topic, setTopic] = useState<string>("");
  const [starting, setStarting] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    toast.success("Room code copied!");
  };

  const handleLeave = async () => {
    await leaveRoom(playerId);
    sessionStorage.removeItem(`player_${room.id}`);
    navigate({ to: "/" });
  };

  const handleStart = async () => {
    if (players.length < 2 && selectedMode !== "coop") {
      // allow solo for testing? require 2 players for fairness
      toast.error("Need 2 players to start");
      return;
    }
    setStarting(true);
    try {
      let actualMode = selectedMode;
      if (selectedMode === "spin_wheel") {
        const pool = ["quiz", "guess_character", "guess_anime", "rapid_fire"];
        actualMode = pool[Math.floor(Math.random() * pool.length)];
        toast.success(`Wheel landed on: ${actualMode.replace("_", " ")}`);
      }

      if (actualMode === "battle_arena") {
        // battle arena uses different flow - questions are character cards
        const { getTopCharacters } = await import("@/lib/jikan");
        const chars = await getTopCharacters(20);
        const cards = chars.slice(0, 10).map((c) => ({
          type: "battle_arena" as const,
          question: c.name,
          imageUrl: c.images?.jpg?.image_url,
          options: [],
          correctIndex: 0,
          stats: { favorites: c.favorites ?? 0, mal_id: c.mal_id },
        }));
        await startGame(room.id, "battle_arena", cards, { topic });
      } else {
        const mode = (actualMode === "coop" ? "coop" : actualMode) as "quiz" | "guess_character" | "guess_anime" | "rapid_fire" | "coop";
        const modeConfig = MODES.find((m) => m.id === selectedMode);
        const count = modeConfig?.count ?? 10;
        const result = await generateQuestions({ data: { mode, topic: topic || "random", count } });
        if (!result.questions.length) {
          toast.error("Failed to generate questions");
          setStarting(false);
          return;
        }
        await startGame(room.id, actualMode, result.questions, { topic, source: result.source, originalMode: selectedMode });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to start");
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Room Code</p>
          <button
            onClick={copyCode}
            className="group flex items-center gap-2 text-4xl font-display tracking-widest text-primary hover:text-accent transition-colors"
          >
            {room.code}
            <Copy className="w-5 h-5 opacity-50 group-hover:opacity-100" />
          </button>
        </div>
        <Button variant="outline" onClick={handleLeave} className="border-border">Leave</Button>
      </div>

      {/* Players */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[0, 1].map((slot) => {
          const p = players[slot];
          return (
            <Card
              key={slot}
              className={`p-6 border-2 ${
                p ? "border-primary/40 bg-card" : "border-dashed border-border bg-card/30"
              }`}
            >
              {p ? (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-blood flex items-center justify-center font-display text-xl text-primary-foreground">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{p.username}</span>
                      {p.is_host && <Crown className="w-4 h-4 text-accent" />}
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {p.id === playerId ? "You" : "Opponent"}
                    </span>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-success animate-pulse-blood" />
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="w-12 h-12 mx-auto rounded-full border-2 border-dashed border-border mb-2" />
                  <p className="text-muted-foreground text-sm">Waiting for opponent...</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Mode selection (host only) */}
      <Card className="p-6 bg-card/80 border-border mb-6">
        <h2 className="font-display text-2xl tracking-wider mb-4 flex items-center gap-2">
          <Sword className="w-5 h-5 text-primary" /> CHOOSE YOUR BATTLE
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {MODES.map((m) => {
            const active = selectedMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => isHost && setSelectedMode(m.id)}
                disabled={!isHost}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10 shadow-blood"
                    : "border-border bg-card/50 hover:border-primary/40"
                } ${!isHost ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <m.icon className={`w-6 h-6 mb-2 ${active ? "text-accent" : "text-muted-foreground"}`} />
                <div className="font-semibold text-sm">{m.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.desc}</div>
              </button>
            );
          })}
        </div>

        {isHost && (
          <>
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">
                Topic / Anime / Genre (optional)
              </label>
              <Input
                placeholder="e.g. Naruto, shonen, romance — leave blank for random"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-input"
              />
            </div>
            <Button
              onClick={handleStart}
              disabled={starting || players.length < 2}
              className="w-full h-12 bg-gradient-ember text-primary-foreground font-display text-lg tracking-wider hover:shadow-glow"
            >
              {starting ? "PREPARING..." : players.length < 2 ? "WAITING FOR OPPONENT" : "BEGIN BATTLE"}
            </Button>
          </>
        )}
        {!isHost && (
          <p className="text-center text-muted-foreground text-sm">
            Waiting for host to start the battle...
          </p>
        )}
      </Card>
    </div>
  );
}
