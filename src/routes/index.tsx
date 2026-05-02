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
        <div className="text-center mb-12 animate-float-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-6">
            <Flame className="w-4 h-4 text-accent" />
            <span className="text-sm tracking-wider uppercase text-accent font-semibold">Real-Time Multiplayer</span>
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-display text-stroke text-foreground mb-4 leading-none">
            ANIME<span className="text-primary">VERSE</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
            Two warriors. One arena. Battle through anime trivia, character guessing, and rapid-fire challenges. Choose your weapon.
          </p>
        </div>

        {/* Auth/Join Card */}
        <Card className="w-full max-w-md p-4 sm:p-6 md:p-8 bg-card/80 backdrop-blur border-primary/30 shadow-blood animate-slash-in">
          <div className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
                Warrior Name
              </label>
              <Input
                placeholder="e.g. Tanjiro"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="bg-input border-border text-lg"
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={loading !== null}
              className="w-full h-12 bg-gradient-blood text-primary-foreground font-display text-lg tracking-wider hover:shadow-glow transition-shadow"
            >
              <Sword className="w-5 h-5 mr-2" />
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

            <div className="flex gap-2">
              <Input
                placeholder="ROOM CODE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="bg-input border-border font-mono tracking-widest text-center text-lg uppercase"
              />
              <Button
                onClick={handleJoin}
                disabled={loading !== null}
                variant="outline"
                className="border-accent/50 text-accent hover:bg-accent/10 font-display tracking-wider px-6"
              >
                {loading === "join" ? "..." : "JOIN"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-12 max-w-4xl w-full px-4">
          {[
            { icon: Users, title: "1v1 Real-Time", desc: "Two-player synced battles" },
            { icon: Zap, title: "7 Game Modes", desc: "Quiz, Rapid Fire, Battle Arena & more" },
            { icon: Flame, title: "AI-Generated", desc: "Fresh questions every match" },
          ].map((f) => (
            <div key={f.title} className="p-4 rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm">
              <f.icon className="w-6 h-6 text-accent mb-2" />
              <div className="font-semibold text-foreground">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground py-6 border-t border-border/30">
        Powered by Jikan API & Lovable AI · Built for anime warriors
      </footer>
    </div>
  );
}
