import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface QuizQuestion {
  type: "quiz" | "guess_character" | "guess_anime" | "rapid_fire";
  question: string;
  imageUrl?: string;
  options: string[];
  correctIndex: number;
  hint?: string;
  topic?: string;
}

const inputSchema = z.object({
  mode: z.enum(["quiz", "guess_character", "guess_anime", "rapid_fire", "coop"]),
  topic: z.string().optional(), // anime title or genre or "random"
  count: z.number().min(3).max(20).default(10),
});

interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string;
  synopsis?: string;
  images: { jpg: { large_image_url: string } };
  genres?: { name: string }[];
}
interface JikanCharacter {
  mal_id: number;
  name: string;
  images: { jpg: { image_url: string } };
  favorites?: number;
}

async function jikanTopAnime(): Promise<JikanAnime[]> {
  try {
    const r = await fetch("https://api.jikan.moe/v4/top/anime?limit=25");
    if (!r.ok) return [];
    return (await r.json()).data || [];
  } catch { return []; }
}
async function jikanTopChars(): Promise<JikanCharacter[]> {
  try {
    const r = await fetch("https://api.jikan.moe/v4/top/characters?limit=25");
    if (!r.ok) return [];
    return (await r.json()).data || [];
  } catch { return []; }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

function buildOptions(correct: string, pool: string[]): { options: string[]; correctIndex: number } {
  const wrong = pick(pool.filter((p) => p !== correct), 3);
  const options = shuffle([correct, ...wrong]);
  return { options, correctIndex: options.indexOf(correct) };
}

// Fallback question generator from Jikan data
async function fallbackQuestions(mode: string, count: number): Promise<QuizQuestion[]> {
  const [animes, chars] = await Promise.all([jikanTopAnime(), jikanTopChars()]);
  const animeNames = animes.map((a) => a.title_english || a.title).filter(Boolean);
  const charNames = chars.map((c) => c.name).filter(Boolean);
  const questions: QuizQuestion[] = [];

  if (mode === "guess_character") {
    for (const c of pick(chars, count)) {
      if (!c.images?.jpg?.image_url) continue;
      const { options, correctIndex } = buildOptions(c.name, charNames);
      questions.push({
        type: "guess_character",
        question: "Which anime character is this?",
        imageUrl: c.images.jpg.image_url,
        options,
        correctIndex,
      });
    }
  } else if (mode === "guess_anime") {
    for (const a of pick(animes.filter((x) => x.synopsis), count)) {
      const title = a.title_english || a.title;
      const synopsis = (a.synopsis || "").slice(0, 280).replace(new RegExp(title, "gi"), "█████");
      const { options, correctIndex } = buildOptions(title, animeNames);
      questions.push({
        type: "guess_anime",
        question: `Guess this anime from the description:\n\n"${synopsis}..."`,
        options,
        correctIndex,
      });
    }
  } else {
    // quiz / rapid_fire / coop fallback - mix of character and anime questions
    const half = Math.ceil(count / 2);
    for (const c of pick(chars, half)) {
      if (!c.images?.jpg?.image_url) continue;
      const { options, correctIndex } = buildOptions(c.name, charNames);
      questions.push({
        type: "quiz",
        question: "Identify this character",
        imageUrl: c.images.jpg.image_url,
        options,
        correctIndex,
      });
    }
    for (const a of pick(animes, count - questions.length)) {
      if (!a.synopsis) continue;
      const title = a.title_english || a.title;
      const synopsis = (a.synopsis || "").slice(0, 220).replace(new RegExp(title, "gi"), "█████");
      const { options, correctIndex } = buildOptions(title, animeNames);
      questions.push({
        type: "quiz",
        question: `Which anime?\n"${synopsis}..."`,
        options,
        correctIndex,
      });
    }
  }
  return shuffle(questions).slice(0, count);
}

async function aiQuestions(mode: string, topic: string, count: number): Promise<QuizQuestion[] | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const topicHint = topic && topic !== "random" ? `Focus on the anime/topic: "${topic}".` : "Pick popular shonen and seinen anime.";
  const prompt = `Generate ${count} multiple-choice anime trivia questions. ${topicHint}
Mix character identification, dialogue completion, ability/power, and episode-based questions.
Each question must have exactly 4 plausible options and one correct answer.
Return ONLY valid JSON, no commentary.`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an anime trivia master. Output strict JSON only." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_questions",
            description: "Return anime trivia questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                      correctIndex: { type: "integer", minimum: 0, maximum: 3 },
                      hint: { type: "string" },
                    },
                    required: ["question", "options", "correctIndex"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_questions" } },
      }),
    });
    if (!r.ok) {
      console.warn("AI gateway error", r.status);
      return null;
    }
    const j = await r.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    const parsed = JSON.parse(args);
    return (parsed.questions || []).slice(0, count).map((q: { question: string; options: string[]; correctIndex: number; hint?: string }) => ({
      type: mode === "rapid_fire" ? "rapid_fire" : "quiz",
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      hint: q.hint,
    }));
  } catch (e) {
    console.warn("AI failed", e);
    return null;
  }
}

export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    // For image-based modes, always use Jikan (we need real character/anime images).
    if (data.mode === "guess_character" || data.mode === "guess_anime") {
      const qs = await fallbackQuestions(data.mode, data.count);
      return { questions: qs, source: "jikan" as const };
    }

    // Try AI first for quiz/rapid_fire/coop
    const ai = await aiQuestions(data.mode, data.topic || "random", data.count);
    if (ai && ai.length >= 3) {
      return { questions: ai, source: "ai" as const };
    }

    const qs = await fallbackQuestions(data.mode, data.count);
    return { questions: qs, source: "jikan" as const };
  });
