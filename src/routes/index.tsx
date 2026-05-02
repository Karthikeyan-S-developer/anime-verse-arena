import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sword, Users, Zap, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createRoom, joinRoom } from "@/lib/room-actions";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);

  const handleCreate = async () => {
    if (!username.trim()) return toast.error("Enter your warrior name");
    setLoading("create");
    try {
      const { roomId, playerId } = await createRoom(username.trim().slice(0, 20));
      sessionStorage.setItem(`player_${roomId}`, playerId);
      sessionStorage.setItem("av_username", username);
      navigate({ to: "/room/$roomId", params: { roomId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create room");
      setLoading(null);
    }
  };

  const handleJoin = async () => {
    if (!username.trim()) return toast.error("Enter your warrior name");
    if (!code.trim()) return toast.error("Enter a room code");
    setLoading("join");
    try {
      const { roomId, playerId } = await joinRoom(code, username.trim().slice(0, 20));
      sessionStorage.setItem(`player_${roomId}`, playerId);
      sessionStorage.setItem("av_username", username);
      navigate({ to: "/room/$roomId", params: { roomId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to join");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster theme="dark" />

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8 sm:mb-12 animate-float-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-4 sm:mb-6">
            <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-accent" />
            <span className="text-xs sm:text-sm tracking-wider uppercase text-accent font-semibold">Real-Time Multiplayer</span>
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display text-stroke text-foreground mb-2 sm:mb-4 leading-none">
            ANIME<span className="text-primary">VERSE</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Two warriors. One arena. Battle through anime trivia, character guessing, and rapid-fire challenges. Choose your weapon.
          </p>
        </div>

        {/* Auth/Join Card */}
        <Card className="w-full max-w-sm sm:max-w-md p-6 sm:p-8 bg-card/80 backdrop-blur border-primary/30 shadow-blood animate-slash-in mx-4">
          <div className="space-y-4 sm:space-y-5">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
                Warrior Name
              </label>
              <Input
                placeholder="e.g. Tanjiro"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="bg-input border-border text-base sm:text-lg h-10 sm:h-11"
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={loading !== null}
              className="w-full h-10 sm:h-12 bg-gradient-blood text-primary-foreground font-display text-base sm:text-lg tracking-wider hover:shadow-glow transition-shadow"
            >
              <Sword className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              {loading === "create" ? "Forging Arena..." : "CREATE BATTLE ROOM"}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">or join</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="ROOM CODE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="bg-input border-border font-mono tracking-widest text-center text-base sm:text-lg uppercase h-10 sm:h-11 flex-1"
              />
              <Button
                onClick={handleJoin}
                disabled={loading !== null}
                variant="outline"
                className="border-accent/50 text-accent hover:bg-accent/10 font-display tracking-wider px-4 sm:px-6 h-10 sm:h-11"
              >
                {loading === "join" ? "..." : "JOIN"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-8 sm:mt-12 max-w-4xl w-full px-4">
          {[
            { icon: Users, title: "1v1 Real-Time", desc: "Two-player synced battles" },
            { icon: Zap, title: "5 Game Modes", desc: "Quiz, Rapid Fire & more" },
            { icon: Flame, title: "AI-Generated", desc: "Fresh questions every match" },
          ].map((f) => (
            <div key={f.title} className="p-3 sm:p-4 rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm">
              <f.icon className="w-5 h-5 sm:w-6 sm:h-6 text-accent mb-2" />
              <div className="font-semibold text-foreground text-sm sm:text-base">{f.title}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
