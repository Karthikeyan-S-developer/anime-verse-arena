import { useState, useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Crown, Sword, Brain, ImageIcon, FileText, Timer, Search, X } from "lucide-react";
import { toast } from "sonner";
import { startGame, leaveRoom } from "@/lib/room-actions";
import { generateQuestions } from "@/lib/questions.server";
import { useNavigate } from "@tanstack/react-router";
import { Profile } from "./Profile";
import { supabase } from "@/integrations/supabase/client";
import { searchAnime, type JikanAnime } from "@/lib/jikan";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];

const MODES = [
  { id: "quiz", name: "Quiz Battle", icon: Brain, desc: "10 timed trivia questions", count: 10 },
  { id: "guess_character", name: "Guess Character", icon: ImageIcon, desc: "Identify from images", count: 8 },
  { id: "guess_anime", name: "Guess the Anime", icon: FileText, desc: "From plot descriptions", count: 8 },
  { id: "rapid_fire", name: "Rapid Fire", icon: Timer, desc: "30s — answer as many as you can", count: 15 },
] as const;

export function Lobby({ room, players, playerId, refresh }: { room: Room; players: Player[]; playerId: string; refresh: () => void }) {
  const navigate = useNavigate();
  const me = players.find((p) => p.id === playerId);
  const isHost = me?.is_host ?? false;
  const [selectedMode, setSelectedMode] = useState<string>((room.game_config as any)?.selectedMode || "quiz");
  const [starting, setStarting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [animeSearchQuery, setAnimeSearchQuery] = useState<string>("");
  const [animeSearchResults, setAnimeSearchResults] = useState<JikanAnime[]>([]);
  const [selectedAnimes, setSelectedAnimes] = useState<JikanAnime[]>((room.game_config as any)?.selectedAnimes || []);
  const [searchingAnime, setSearchingAnime] = useState(false);

  useEffect(() => {
    const config = room.game_config as any;
    if (config) {
      setSelectedMode(config.selectedMode || "quiz");
      setSelectedAnimes(config.selectedAnimes || []);
    }
  }, [room.game_config]);

  const updateSelectedMode = async (mode: string) => {
    if (!isHost) return;
    try {
      const currentConfig = (room.game_config as any) || {};
      await supabase
        .from("rooms")
        .update({ game_config: { ...currentConfig, selectedMode: mode } })
        .eq("id", room.id);
      setSelectedMode(mode);
    } catch (error) {
      console.error("Failed to update mode:", error);
    }
  };

  const searchAnimeHandler = async () => {
    if (!animeSearchQuery.trim()) return;
    setSearchingAnime(true);
    try {
      const results = await searchAnime(animeSearchQuery);
      setAnimeSearchResults(results);
    } catch (error) {
      toast.error("Failed to search anime");
    } finally {
      setSearchingAnime(false);
    }
  };

  const selectAnime = async (anime: JikanAnime) => {
    if (!isHost) return;
    try {
      const currentConfig = (room.game_config as any) || {};
      const newAnimes = [...(currentConfig.selectedAnimes || []), anime];
      await supabase
        .from("rooms")
        .update({ game_config: { ...currentConfig, selectedAnimes: newAnimes } })
        .eq("id", room.id);
      setSelectedAnimes(newAnimes);
      setAnimeSearchResults([]);
      setAnimeSearchQuery("");
      toast.success(`Added: ${anime.title_english || anime.title}`);
    } catch (error) {
      console.error("Failed to select anime:", error);
      toast.error("Failed to add anime");
    }
  };

  const removeAnime = async (malId: number) => {
    if (!isHost) return;
    try {
      const currentConfig = (room.game_config as any) || {};
      const newAnimes = (currentConfig.selectedAnimes || []).filter((a: JikanAnime) => a.mal_id !== malId);
      await supabase
        .from("rooms")
        .update({ game_config: { ...currentConfig, selectedAnimes: newAnimes } })
        .eq("id", room.id);
      setSelectedAnimes(newAnimes);
      toast.success("Anime removed");
    } catch (error) {
      console.error("Failed to remove anime:", error);
      toast.error("Failed to remove anime");
    }
  };

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
    if (players.length < 1) {
      toast.error("Need at least 1 player to start");
      return;
    }
    
    // For modes other than guess_anime, require selected animes
    const mode = selectedMode as "quiz" | "guess_character" | "guess_anime" | "rapid_fire";
    if (mode !== "guess_anime" && selectedAnimes.length === 0) {
      toast.error("Please select at least one anime");
      return;
    }

    setStarting(true);
    try {
      const modeConfig = MODES.find((m) => m.id === selectedMode);
      const count = modeConfig?.count ?? 10;
      
      // Create topic from selected animes
      const topic = selectedAnimes.map(a => a.title_english || a.title).join(", ");
      
      const result = await generateQuestions({ 
        data: { 
          mode, 
          topic: topic || "random", 
          count,
          selectedAnimes: selectedAnimes
        } 
      });
      if (!result.questions.length) {
        toast.error("Failed to generate questions");
        setStarting(false);
        return;
      }
      await startGame(room.id, selectedMode, result.questions, { 
        source: result.source, 
        originalMode: selectedMode,
        selectedAnimes: selectedAnimes
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to start");
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen px-3 sm:px-4 py-6 sm:py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Room Code</p>
          <button
            onClick={copyCode}
            className="group flex items-center gap-2 text-2xl sm:text-3xl md:text-4xl font-display tracking-widest text-primary hover:text-accent transition-colors"
          >
            {room.code}
            <Copy className="w-4 sm:w-5 h-4 sm:h-5 opacity-50 group-hover:opacity-100" />
          </button>
        </div>
        <Button variant="outline" onClick={handleLeave} className="border-border text-sm sm:text-base">Leave</Button>
      </div>

      {/* Players */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {players.map((p) => (
          <Card
            key={p.id}
            className={`p-6 border-2 transition-all ${
              p.id === playerId
                ? "border-primary/60 bg-card cursor-pointer hover:border-primary hover:shadow-blood"
                : "border-primary/40 bg-card"
            }`}
            onClick={p.id === playerId ? () => setProfileOpen(true) : undefined}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-blood flex items-center justify-center font-display text-lg sm:text-xl text-primary-foreground flex-shrink-0 overflow-hidden">
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
              <div className="flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm sm:text-lg truncate">{p.username}</span>
                  {p.is_host && <Crown className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" />}
                </div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground truncate">
                  {p.id === playerId ? "You (click to edit)" : "Player"}
                </span>
              </div>
              <div className="w-3 h-3 rounded-full bg-success animate-pulse-blood" />
            </div>
          </Card>
        ))}
      </div>

      {/* Mode selection */}
      <Card className="p-4 sm:p-6 bg-card/80 border-border mb-6">
        <h2 className="font-display text-xl sm:text-2xl tracking-wider mb-4 flex items-center gap-2">
          <Sword className="w-5 h-5 text-primary" /> CHOOSE YOUR BATTLE
        </h2>
        {!isHost && (
          <p className="text-sm text-muted-foreground mb-4">
            Host is selecting the game mode...
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
          {MODES.map((m) => {
            const active = selectedMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => updateSelectedMode(m.id)}
                disabled={!isHost}
                className={`p-2 sm:p-4 rounded-lg border-2 text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10 shadow-blood"
                    : "border-border bg-card/50 hover:border-primary/40"
                } ${!isHost ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <m.icon className={`w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-2 ${active ? "text-accent" : "text-muted-foreground"}`} />
                <div className="font-semibold text-xs sm:text-sm">{m.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1">{m.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Animes Display - visible to all players */}
        {selectedMode !== "guess_anime" && selectedAnimes.length > 0 && (
          <div className="mb-6">
            <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">
              Selected Animes for This Round
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {selectedAnimes.map((anime) => (
                <Card key={anime.mal_id} className="p-3 border-primary/40 bg-card/50 relative group">
                  <img
                    src={anime.images.jpg.image_url}
                    alt={anime.title}
                    className="w-full h-24 object-cover rounded mb-2"
                  />
                  <p className="text-xs font-semibold truncate">{anime.title_english || anime.title}</p>
                  {isHost && (
                    <button
                      onClick={() => removeAnime(anime.mal_id)}
                      className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {isHost && selectedMode !== "guess_anime" && (
          <>
            {/* Anime Search Section - host only, not for guess_anime */}
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">
                Add Animes for This Round
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Search for anime (e.g. Naruto, One Piece)"
                  value={animeSearchQuery}
                  onChange={(e) => setAnimeSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && searchAnimeHandler()}
                  className="bg-input"
                />
                <Button onClick={searchAnimeHandler} disabled={searchingAnime} size="sm">
                  {searchingAnime ? "..." : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {/* Search Results */}
              {animeSearchResults.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  <p className="text-xs text-muted-foreground">Click to add:</p>
                  {animeSearchResults.map((anime) => (
                    <button
                      key={anime.mal_id}
                      onClick={() => selectAnime(anime)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg border border-border hover:border-primary/40 transition-colors text-left"
                    >
                      <img
                        src={anime.images.jpg.image_url}
                        alt={anime.title}
                        className="w-8 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{anime.title_english || anime.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {anime.genres?.slice(0, 2).map(g => g.name).join(", ")}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={handleStart}
              disabled={starting || players.length < 2 || (selectedMode !== "guess_anime" && selectedAnimes.length === 0)}
              className="w-full h-12 bg-gradient-ember text-primary-foreground font-display text-lg tracking-wider hover:shadow-glow"
            >
              {starting ? "PREPARING..." : players.length < 1 ? "WAITING FOR PLAYERS" : "BEGIN BATTLE"}
            </Button>
          </>
        )}

        {isHost && selectedMode === "guess_anime" && (
          <Button
            onClick={handleStart}
            disabled={starting || players.length < 2}
            className="w-full h-12 bg-gradient-ember text-primary-foreground font-display text-lg tracking-wider hover:shadow-glow"
          >
            {starting ? "PREPARING..." : players.length < 1 ? "WAITING FOR PLAYERS" : "BEGIN BATTLE"}
          </Button>
        )}
        {!isHost && (
          <p className="text-center text-muted-foreground text-sm">
            Waiting for host to start the battle...
          </p>
        )}
      </Card>
      <Profile
        player={me!}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onUpdate={refresh}
      />
    </div>
  );
}
