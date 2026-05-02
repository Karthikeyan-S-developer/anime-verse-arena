export type QuizQuestion = {
  type: "quiz" | "guess_character" | "guess_anime" | "rapid_fire";
  question: string;
  imageUrl?: string;
  options: string[];
  correctIndex: number;
  hint?: string;
  topic?: string;
};

export type QuestionSource = "jikan" | "ai";

export async function generateQuestions(input: {
  data: {
    mode: "quiz" | "guess_character" | "guess_anime" | "rapid_fire";
    topic: string;
    count: number;
  };
}) {
  const response = await fetch("/api/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.data),
  });

  if (!response.ok) {
    throw new Error("Failed to generate questions");
  }

  return (await response.json()) as { questions: QuizQuestion[]; source: QuestionSource };
}
