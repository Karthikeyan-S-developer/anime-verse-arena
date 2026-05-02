// Jikan (MyAnimeList) API helpers - public, no key needed
const JIKAN = "https://api.jikan.moe/v4";

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string;
  synopsis?: string;
  score?: number;
  popularity?: number;
  favorites?: number;
  members?: number;
  images: { jpg: { large_image_url: string; image_url: string } };
  genres?: { name: string }[];
}

export interface JikanCharacter {
  mal_id: number;
  name: string;
  images: { jpg: { image_url: string } };
  favorites?: number;
  about?: string;
}

export async function getTopAnime(limit = 25): Promise<JikanAnime[]> {
  const r = await fetch(`${JIKAN}/top/anime?limit=${limit}`);
  if (!r.ok) return [];
  const j = await r.json();
  return j.data || [];
}

export async function getTopCharacters(limit = 25): Promise<JikanCharacter[]> {
  const r = await fetch(`${JIKAN}/top/characters?limit=${limit}`);
  if (!r.ok) return [];
  const j = await r.json();
  return j.data || [];
}

export async function searchAnime(q: string): Promise<JikanAnime[]> {
  const r = await fetch(`${JIKAN}/anime?q=${encodeURIComponent(q)}&limit=10&sfw=true`);
  if (!r.ok) return [];
  const j = await r.json();
  return j.data || [];
}
