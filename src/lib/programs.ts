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

export function clampWeek(n: number, totalWeeks: number): number {
  return Math.min(Math.max(n, 1), totalWeeks);
}
