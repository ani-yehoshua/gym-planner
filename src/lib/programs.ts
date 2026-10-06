import { addDays } from "./date";

export type DurationUnit = "days" | "weeks";

/** What an admin submits when creating or saving a program: an ordered list of
 *  days (training days with exercises, or rest days) and a duration. */
export type ProgramInput = {
  id?: string;
  name: string;
  description: string;
  durationUnit: DurationUnit;
  durationCount: number;
  days: {
    name: string;
    isRest: boolean;
    exercises: {
      exerciseId: string;
      sets: number | null;
      repMin: number | null;
      repMax: number | null;
    }[];
  }[];
};

export function clampDuration(unit: DurationUnit, count: number): number {
  const max = unit === "weeks" ? 52 : 365;
  return Math.min(Math.max(Math.round(count) || 1, 1), max);
}

/** How many calendar days a program runs for. */
export function programTotalDays(unit: DurationUnit, count: number): number {
  return unit === "weeks" ? count * 7 : count;
}

/** The last date of a program started on `start`. */
export function programEndDate(
  start: string,
  unit: DurationUnit,
  count: number,
): string {
  return addDays(start, programTotalDays(unit, count) - 1);
}

export function durationLabel(unit: string, count: number): string {
  const word = unit === "weeks" ? "week" : "day";
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The Calendar's "Plan session…" lists programs next to the plain session
 *  types; this prefix on the option value tells them apart. */
export const PROGRAM_PREFIX = "program:";

export function programChoiceValue(programId: string): string {
  return `${PROGRAM_PREFIX}${programId}`;
}

export function parseProgramChoice(value: string): string | null {
  return value.startsWith(PROGRAM_PREFIX)
    ? value.slice(PROGRAM_PREFIX.length) || null
    : null;
}

/** "3 × 8–12", "3 sets", "8–12 reps", or "" when nothing's specified. */
export function formatRx(
  sets: number | null,
  repMin: number | null,
  repMax: number | null,
  unit = "reps",
): string {
  const reps = formatRepRange(repMin, repMax);
  if (sets != null && reps) return `${sets} × ${reps}`;
  if (sets != null) return `${sets} sets`;
  return reps ? `${reps} ${unit}` : "";
}

/** "8–12", "10", "8+", "up to 12", or "" — a rep range on its own. */
export function formatRepRange(
  repMin: number | null,
  repMax: number | null,
): string {
  if (repMin != null && repMax != null)
    return repMin === repMax ? `${repMin}` : `${repMin}–${repMax}`;
  if (repMin != null) return `${repMin}+`;
  if (repMax != null) return `up to ${repMax}`;
  return "";
}
