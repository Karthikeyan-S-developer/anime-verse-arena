import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];
type Answer = Database["public"]["Tables"]["answers"]["Row"];

export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    const [r, p, a] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
      supabase.from("players").select("*").eq("room_id", roomId).order("created_at"),
      supabase.from("answers").select("*").eq("room_id", roomId),
    ]);
    setRoom(r.data ?? null);
    setPlayers(p.data ?? []);
    setAnswers(a.data ?? []);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    refresh();
    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  return { room, players, answers, loading, refresh };
}
