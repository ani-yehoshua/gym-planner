/** A program is a saved day: "Plan session…" lists them next to the plain
 *  session types, with this prefix on the option value to tell them apart. */
export const PROGRAM_PREFIX = "program:";

export function programChoiceValue(programId: string): string {
  return `${PROGRAM_PREFIX}${programId}`;
}

/** The program id out of a "Plan session…" option value, or null if it's one of
 *  the plain session types. */
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
  return reps ? `${reps} ${unit}` : "";
}
