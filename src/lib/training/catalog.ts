import lessonData from "./lessons.json";

export type TrainingLesson = {
  id: string;
  title: string;
  href: string;
  category: string;
  audience: string;
  summary: string;
  steps: { title: string; instruction: string }[];
  coveredRoutes: string[];
  status: string;
};

export const trainingLessons: TrainingLesson[] = lessonData;

export function filterTrainingLessons(isStaff: boolean, query = "", audience = "all", category = "all") {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return trainingLessons.filter((lesson) => {
    if (lesson.audience === "staff" && !isStaff) return false;
    if (audience === "pha" && !["all", "pha"].includes(lesson.audience)) return false;
    if (audience === "multifamily" && lesson.audience !== "all") return false;
    if (audience === "staff" && lesson.audience !== "staff") return false;
    if (category !== "all" && lesson.category !== category) return false;
    const text = [lesson.title, lesson.summary, lesson.category, ...lesson.steps.flatMap((step) => [step.title, step.instruction])].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

export function parseTrainingProgress(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const ids = new Set(trainingLessons.map((lesson) => lesson.id));
    return [...new Set(value.filter((id): id is string => typeof id === "string" && ids.has(id)))];
  } catch { return []; }
}
