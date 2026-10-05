import { addDays, parseISODate, startOfWeek } from "./date";
import type { Enums } from "./supabase/database.types";

type Cat = Enums<"muscle_category">;

/** The muscle groups a program sets weekly targets for — exercise categories,
 *  which are exact (every set belongs to exactly one). Cardio isn't a "set"
 *  count, so it's left out. */
export const PROGRAM_GROUPS: readonly Cat[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
];

export function isProgramGroup(c: string): c is Cat {
  return (PROGRAM_GROUPS as readonly string[]).includes(c);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000,
  );
}

/** Week 1 is the Sunday-start week containing the start date. */
export function programWeekStart(startDate: string, weekNo: number): string {
  return addDays(startOfWeek(startDate), (weekNo - 1) * 7);
}

/** Which program week `todayISO` falls in. Can be < 1 (not started yet) or
 *  > totalWeeks (finished) — callers clamp for display. */
export function programWeekNo(startDate: string, todayISO: string): number {
  return (
    Math.floor(
      daysBetween(startOfWeek(startDate), startOfWeek(todayISO)) / 7,
    ) + 1
  );
}

type ProgramExerciseLike = {
  sort: number;
  exercises: { name: string; category: Cat } | null;
};

/** A program's exercises bucketed by muscle group (the exercise's category):
 *  the targeted groups first in their usual order, anything else after.
 *  Within a group, in the order the admin added them. */
export function groupProgramExercises<T extends ProgramExerciseLike>(
  rows: T[],
): { category: Cat; rows: T[] }[] {
  const by = new Map<Cat, T[]>();
  for (const r of rows) {
    if (!r.exercises) continue;
    const arr = by.get(r.exercises.category) ?? [];
    arr.push(r);
    by.set(r.exercises.category, arr);
  }
  const order = [
    ...PROGRAM_GROUPS,
    ...[...by.keys()].filter((c) => !isProgramGroup(c)).sort(),
  ];
  return order
    .filter((c) => by.has(c))
    .map((category) => ({
      category,
      rows: by
        .get(category)!
        .sort(
          (a, b) =>
            a.sort - b.sort || a.exercises!.name.localeCompare(b.exercises!.name),
        ),
    }));
}

/** "3 × 8–12", "3 sets", "8–12 reps", or "" when nothing's specified. */
export function formatRx(
  sets: number | null,
  repMin: number | null,
  repMax: number | null,
): string {
  const reps =
    repMin != null && repMax != null
      ? repMin === repMax
        ? `${repMin}`
        : `${repMin}–${repMax}`
      : repMin != null
        ? `${repMin}+`
        : repMax != null
          ? `up to ${repMax}`
          : "";
  if (sets != null && reps) return `${sets} × ${reps}`;
  if (sets != null) return `${sets} sets`;
  return reps ? `${reps} reps` : "";
}

export function clampWeek(n: number, totalWeeks: number): number {
  return Math.min(Math.max(n, 1), totalWeeks);
}
