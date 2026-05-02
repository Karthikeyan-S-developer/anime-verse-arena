import { z } from "zod";

const inputSchema = z.object({
  mode: z.enum(["quiz", "guess_character", "guess_anime", "rapid_fire"]),
  topic: z.string().optional(),
  count: z.number().min(3).max(20).default(10),
});

type QuizQuestion = {
  type: "quiz" | "guess_character" | "guess_anime" | "rapid_fire";
  question: string;
  imageUrl?: string;
  options: string[];
  correctIndex: number;
  hint?: string;
  topic?: string;
};

async function jikanTopAnime(): Promise<any[]> {
  try {
    const r = await fetch("https://api.jikan.moe/v4/top/anime?limit=25");
    if (!r.ok) return [];
    return (await r.json()).data || [];
  } catch {
    return [];
  }
}

async function jikanTopChars(): Promise<any[]> {
  try {
    const r = await fetch("https://api.jikan.moe/v4/top/characters?limit=25");
    if (!r.ok) return [];
    return (await r.json()).data || [];
  } catch {
    return [];
  }
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

async function fallbackQuestions(mode: string, count: number): Promise<QuizQuestion[]> {
  const [animes, chars] = await Promise.all([jikanTopAnime(), jikanTopChars()]);
  const animeNames = animes.map((a) => (a.title_english || a.title)).filter(Boolean);
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
  const prompt = `Generate ${count} multiple-choice anime trivia questions. ${topicHint}\nMix character identification, dialogue completion, ability/power, and episode-based questions.\nEach question must have exactly 4 plausible options and one correct answer.\nReturn ONLY valid JSON, no commentary.`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an anime trivia master. Output strict JSON only." },
          { role: "user", content: prompt }
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
                      hint: { type: "string" }
                    },
                    required: ["question", "options", "correctIndex"]
                  }
                }
              },
              required: ["questions"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_questions" } }
      })
    });

    if (!r.ok) {
      console.warn("AI gateway error", r.status);
      return null;
    }

    const j = await r.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;

    const parsed = JSON.parse(args);
    return (parsed.questions || []).slice(0, count).map((q: any) => ({
      type: mode === "rapid_fire" ? "rapid_fire" : "quiz",
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      hint: q.hint,
    }));
  } catch (error) {
    console.warn("AI failed", error);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request payload", issues: parsed.error.format() });
  }

  const { mode, topic = "random", count } = parsed.data;
  let questions = null;
  let source: "jikan" | "ai" = "jikan";

  if (mode === "guess_character" || mode === "guess_anime") {
    questions = await fallbackQuestions(mode, count);
    source = "jikan";
  } else {
    const ai = await aiQuestions(mode, topic, count);
    if (ai && ai.length >= 3) {
      questions = ai;
      source = "ai";
    } else {
      questions = await fallbackQuestions(mode, count);
      source = "jikan";
    }
  }

  return res.status(200).json({ questions, source });
}
