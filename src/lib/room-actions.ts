import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode } from "@/lib/utils";

export async function createRoom(username: string): Promise<{ roomId: string; playerId: string; code: string }> {
  // Try a few codes in case of collision
  let code = generateRoomCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase.from("rooms").select("id").eq("code", code).maybeSingle();
    if (!existing) break;
    code = generateRoomCode();
    attempts++;
  }
  const { data: room, error } = await supabase
    .from("rooms")
    .insert({ code, status: "lobby" })
    .select()
    .single();
  if (error || !room) throw error || new Error("Failed to create room");

  const { data: player, error: pErr } = await supabase
    .from("players")
    .insert({ room_id: room.id, username, is_host: true })
    .select()
    .single();
  if (pErr || !player) throw pErr || new Error("Failed to create player");

  await supabase.from("rooms").update({ host_player_id: player.id }).eq("id", room.id);

  return { roomId: room.id, playerId: player.id, code: room.code };
}

export async function joinRoom(code: string, username: string): Promise<{ roomId: string; playerId: string }> {
  const upper = code.toUpperCase().trim();
  const { data: room, error } = await supabase.from("rooms").select("*").eq("code", upper).maybeSingle();
  if (error || !room) throw new Error("Room not found");

  const { count } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);

  if ((count ?? 0) >= 2) throw new Error("Room is full");
  if (room.status !== "lobby") throw new Error("Game already in progress");

  const { data: player, error: pErr } = await supabase
    .from("players")
    .insert({ room_id: room.id, username, is_host: false })
    .select()
    .single();
  if (pErr || !player) throw pErr || new Error("Failed to join");

  return { roomId: room.id, playerId: player.id };
}

export async function leaveRoom(playerId: string) {
  await supabase.from("players").delete().eq("id", playerId);
}

export async function setReady(playerId: string, ready: boolean) {
  await supabase.from("players").update({ ready }).eq("id", playerId);
}

export async function startGame(roomId: string, mode: string, questions: unknown[], config: Record<string, unknown>) {
  await supabase
    .from("rooms")
    .update({
      status: "playing",
      game_mode: mode,
      questions: questions as never,
      game_config: config as never,
      current_question: 0,
      question_started_at: new Date().toISOString(),
    })
    .eq("id", roomId);
}

export async function nextQuestion(roomId: string, currentIndex: number) {
  await supabase
    .from("rooms")
    .update({
      current_question: currentIndex + 1,
      question_started_at: new Date().toISOString(),
    })
    .eq("id", roomId);
}

export async function finishGame(roomId: string) {
  await supabase.from("rooms").update({ status: "finished" }).eq("id", roomId);
}

export async function submitAnswer(params: {
  roomId: string;
  playerId: string;
  questionIndex: number;
  answer: string;
  isCorrect: boolean;
  pointsEarned: number;
  answerMs: number;
}) {
  const { error } = await supabase.from("answers").insert({
    room_id: params.roomId,
    player_id: params.playerId,
    question_index: params.questionIndex,
    answer: params.answer,
    is_correct: params.isCorrect,
    points_earned: params.pointsEarned,
    answer_ms: params.answerMs,
  });
  if (error && error.code !== "23505") throw error;
}

export async function updatePlayerScore(playerId: string, delta: { score: number; streak: number; correct: boolean; answerMs: number }) {
  const { data: p } = await supabase.from("players").select("*").eq("id", playerId).single();
  if (!p) return;
  await supabase
    .from("players")
    .update({
      score: p.score + delta.score,
      streak: delta.correct ? p.streak + 1 : 0,
      correct_count: p.correct_count + (delta.correct ? 1 : 0),
      total_answer_ms: p.total_answer_ms + delta.answerMs,
    })
    .eq("id", playerId);
}

export async function backToLobby(roomId: string) {
  await supabase.from("answers").delete().eq("room_id", roomId);
  await supabase
    .from("rooms")
    .update({ status: "lobby", game_mode: null, questions: [], current_question: 0, question_started_at: null })
    .eq("id", roomId);
  // reset player scores
  const { data: ps } = await supabase.from("players").select("id").eq("room_id", roomId);
  if (ps) {
    for (const p of ps) {
      await supabase.from("players").update({ score: 0, streak: 0, correct_count: 0, total_answer_ms: 0, ready: false }).eq("id", p.id);
    }
  }
}
