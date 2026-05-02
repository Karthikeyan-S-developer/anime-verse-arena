import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { searchCharacters, type JikanCharacter } from "@/lib/jikan";
import { updatePlayerProfile } from "@/lib/room-actions";
import { toast } from "sonner";
import { Loader2, Search, User } from "lucide-react";

type Player = {
  id: string;
  username: string;
  selected_character: any;
};

interface ProfileProps {
  player: Player;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function Profile({ player, open, onClose, onUpdate }: ProfileProps) {
  const [username, setUsername] = useState(player.username);
  const [selectedCharacter, setSelectedCharacter] = useState<JikanCharacter | null>(
    player.selected_character ? player.selected_character : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JikanCharacter[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchCharacters(searchQuery);
      setSearchResults(results);
    } catch (error) {
      toast.error("Failed to search characters");
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePlayerProfile(player.id, username, selectedCharacter);
      toast.success("Profile updated!");
      onUpdate();
      onClose();
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const selectCharacter = (character: JikanCharacter) => {
    setSelectedCharacter(character);
    setSearchResults([]);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Edit Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={selectedCharacter?.images.jpg.image_url} />
              <AvatarFallback className="bg-gradient-blood text-primary-foreground text-xl">
                {username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchResults([])}
              className="text-xs"
            >
              Change Picture
            </Button>
          </div>

          {/* Search Section */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Anime Character</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                placeholder="e.g. Naruto Uzumaki"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching} size="sm">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label>Results</Label>
              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {searchResults.map((char) => (
                  <button
                    key={char.mal_id}
                    onClick={() => selectCharacter(char)}
                    className="p-2 rounded-lg border hover:border-primary transition-colors"
                  >
                    <Avatar className="w-12 h-12 mx-auto mb-1">
                      <AvatarImage src={char.images.jpg.image_url} />
                      <AvatarFallback>{char.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="text-xs text-center truncate">{char.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}