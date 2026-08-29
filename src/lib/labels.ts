import type { Enums } from "./supabase/database.types";

export const CATEGORY_LABEL: Record<Enums<"muscle_category">, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  lower: "Lower",
  full_body: "Full Body",
  core: "Core",
  cardio: "Cardio",
  custom: "Custom",
  rest: "Rest",
};

export const CATEGORY_ORDER: Enums<"muscle_category">[] = [
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
  "full_body",
  "core",
  "cardio",
  "custom",
  "rest",
];

// tailwind classes per category — used for chips / day headers (theme-aware)
export const CATEGORY_STYLE: Record<Enums<"muscle_category">, string> = {
  push: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  pull: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  legs: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  upper: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  lower: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  full_body: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  core: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  cardio: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  custom: "bg-surface-2 text-text-muted border-border",
  rest: "bg-surface-2 text-text-muted border-border",
};

// Which exercise categories belong on a day of a given category.
// Upper/Lower/Full-Body days draw from the push/pull/legs pools.
export const DAY_ACCEPTS: Record<Enums<"muscle_category">, Enums<"muscle_category">[]> = {
  push: ["push"],
  pull: ["pull"],
  legs: ["legs"],
  upper: ["push", "pull", "upper", "core"],
  lower: ["legs", "lower", "core"],
  full_body: ["push", "pull", "legs", "upper", "lower", "full_body", "core"],
  core: ["core"],
  cardio: ["cardio"],
  custom: ["push", "pull", "legs", "upper", "lower", "full_body", "core", "cardio", "custom"],
  rest: ["push", "pull", "legs", "upper", "lower", "full_body", "core", "cardio", "custom"],
};

export function dayAcceptsExercise(
  dayCategory: Enums<"muscle_category"> | null,
  exerciseCategory: Enums<"muscle_category">,
): boolean {
  if (!dayCategory) return true;
  return DAY_ACCEPTS[dayCategory].includes(exerciseCategory);
}

export const MUSCLE_LABEL: Record<Enums<"muscle_group">, string> = {
  chest: "Chest",
  back: "Back",
  lats: "Lats",
  traps: "Traps",
  shoulders: "Shoulders",
  front_delts: "Front Delts",
  side_delts: "Side Delts",
  rear_delts: "Rear Delts",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  adductors: "Adductors",
  abs: "Abs",
  lower_back: "Lower Back",
  neck: "Neck",
  cardio: "Cardio",
  full_body: "Full Body",
  other: "Other",
};

export const GOAL_LABEL: Record<string, string> = {
  build_muscle: "Build muscle",
  get_stronger: "Get stronger",
  lose_fat: "Lose fat",
  general_fitness: "General fitness",
};
