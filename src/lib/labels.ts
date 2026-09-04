import type { Enums } from "./supabase/database.types";

export const CATEGORY_LABEL: Record<Enums<"muscle_category">, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  lower: "Lower",
  full_body: "Full Body",
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
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
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "cardio",
  "custom",
  "rest",
];

// categories offered when planning / editing a day (everything except "custom")
export const DAY_CATEGORY_CHOICES: Enums<"muscle_category">[] = CATEGORY_ORDER.filter(
  (c) => c !== "custom",
);

// tailwind classes per category — used for chips / day headers (theme-aware)
export const CATEGORY_STYLE: Record<Enums<"muscle_category">, string> = {
  push: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  pull: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  legs: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  upper: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  lower: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  full_body: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  chest: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  back: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  shoulders: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  arms: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
  core: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  cardio: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  custom: "bg-surface-2 text-text-muted border-border",
  rest: "bg-surface-2 text-text-muted border-border",
};

// solid dot colors matching CATEGORY_STYLE's color family — for small
// indicators (nav badges) where the tinted/bordered chip look doesn't fit
export const CATEGORY_DOT: Record<Enums<"muscle_category">, string> = {
  push: "bg-rose-500",
  pull: "bg-sky-500",
  legs: "bg-amber-500",
  upper: "bg-violet-500",
  lower: "bg-emerald-500",
  full_body: "bg-indigo-500",
  chest: "bg-rose-500",
  back: "bg-sky-500",
  shoulders: "bg-cyan-500",
  arms: "bg-fuchsia-500",
  core: "bg-orange-500",
  cardio: "bg-teal-500",
  custom: "bg-text-muted",
  rest: "bg-text-muted",
};

// Every exercise now carries one of these 7 body-part categories — push/pull/
// upper/lower/full_body/custom/rest are day-only types with no exercises of
// their own, so they draw from this pool instead.
const BODY_PART_CATS: Enums<"muscle_category">[] = [
  "chest", "back", "shoulders", "arms", "legs", "core", "cardio",
];

export const DAY_ACCEPTS: Record<Enums<"muscle_category">, Enums<"muscle_category">[]> = {
  push: ["chest", "shoulders", "arms"],
  pull: ["back", "arms"],
  legs: ["legs"],
  upper: ["chest", "back", "shoulders", "arms", "core"],
  lower: ["legs"],
  full_body: BODY_PART_CATS,
  chest: ["chest"],
  back: ["back"],
  shoulders: ["shoulders"],
  arms: ["arms"],
  core: ["core"],
  cardio: ["cardio"],
  custom: BODY_PART_CATS,
  rest: BODY_PART_CATS,
};

export function dayAcceptsExercise(
  dayCategory: Enums<"muscle_category"> | null,
  exerciseCategory: Enums<"muscle_category">,
): boolean {
  if (!dayCategory) return true;
  return DAY_ACCEPTS[dayCategory].includes(exerciseCategory);
}

export const MUSCLE_LABEL: Record<string, string> = {
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

// muscle targets are free-form text now — fall back to title-casing anything unknown
export function muscleLabel(m: string): string {
  return (
    MUSCLE_LABEL[m] ??
    m
      .split(/[_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function muscleList(ms: string[]): string {
  return ms.map(muscleLabel).join(", ");
}

// common muscle targets offered as quick-pick / autocomplete when editing an exercise
export const COMMON_MUSCLES: string[] = [
  "chest", "back", "lats", "traps", "front_delts", "side_delts", "rear_delts",
  "shoulders", "biceps", "triceps", "forearms", "quads", "hamstrings", "glutes",
  "calves", "adductors", "abs", "lower_back",
];

export const GOAL_LABEL: Record<string, string> = {
  build_muscle: "Build muscle",
  get_stronger: "Get stronger",
  lose_fat: "Lose fat",
  general_fitness: "General fitness",
};
