import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function getOrCreatePlayerKey(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("animeverse_player_key");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("animeverse_player_key", id);
  }
  return id;
}

export function calculateScore(answerMs: number, streak: number): number {
  // Base 10 points + speed bonus (up to 10) + streak multiplier
  const speedBonus = Math.max(0, Math.round(10 - answerMs / 1000));
  const streakMult = 1 + Math.min(streak, 5) * 0.1;
  return Math.round((10 + speedBonus) * streakMult);
}
