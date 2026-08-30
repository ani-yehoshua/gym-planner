import type { Enums } from "./supabase/database.types";

export type Goal = "build_muscle" | "get_stronger" | "lose_fat" | "general_fitness";

// Multi-joint lifts that carry more of a session's stimulus.
const COMPOUND = new Set([
  "Barbell Bench Press", "Incline Barbell Press", "Incline Dumbbell Press",
  "Overhead Barbell Press", "Seated Dumbbell Shoulder Press", "Arnold Press",
  "Dips", "Machine Chest Press",
  "Pull-up", "Assisted Pull-up", "Lat Pulldown", "Wide-Grip Lat Pulldown",
  "Barbell Row", "Seated Cable Row", "Chest-Supported Row", "Single-Arm Dumbbell Row",
  "Barbell Back Squat", "Front Squat", "Goblet Squat", "Leg Press",
  "Romanian Deadlift", "Conventional Deadlift", "Hip Thrust",
  "Bulgarian Split Squat", "Walking Lunge",
]);

export function isCompound(ex: { name: string; primary_muscles: Enums<"muscle_group">[] }): boolean {
  return COMPOUND.has(ex.name) || ex.primary_muscles.length >= 2;
}

/** Recommended rep range for a goal + exercise type. */
export function recommendedReps(goal: Goal | null, compound: boolean): [number, number] {
  switch (goal) {
    case "get_stronger":
      return compound ? [3, 6] : [6, 10];
    case "lose_fat":
      return compound ? [8, 12] : [12, 20];
    case "general_fitness":
      return compound ? [6, 12] : [10, 15];
    case "build_muscle":
    default:
      return compound ? [6, 10] : [10, 15];
  }
}

/** Suggested working-set count. The stored default is always 2 — this is the
 *  number we surface as "suggested N" so the user can dial up to it. */
export function suggestedSets(
  goal: Goal | null,
  experience: Enums<"experience_level"> | null,
  compound: boolean,
): number {
  let sets: number;
  switch (goal) {
    case "get_stronger":
      sets = compound ? 4 : 2;
      break;
    case "lose_fat":
      sets = 3;
      break;
    case "general_fitness":
      sets = compound ? 3 : 2;
      break;
    case "build_muscle":
    default:
      sets = compound ? 4 : 3;
  }
  if (experience === "beginner") sets -= 1;
  if (experience === "advanced") sets += 1;
  return Math.min(6, Math.max(2, sets));
}

export const DEFAULT_SETS = 2;
