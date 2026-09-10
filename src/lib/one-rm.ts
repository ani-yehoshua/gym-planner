/** Epley: estimated 1RM from a set. Capped at 12 reps, where the estimate
 *  stays meaningful. */
export function epley1rm(weight: number, reps: number): number {
  return weight * (1 + Math.min(reps, 12) / 30);
}

/** Inverse Epley: the weight you'd expect to lift for `reps` at a given 1RM. */
export function workingFrom1rm(oneRm: number, reps: number): number {
  return oneRm / (1 + Math.min(reps, 12) / 30);
}

export const round5 = (n: number) => Math.round(n / 5) * 5;

/** Rep count used to convert between a working weight and a 1RM on the
 *  Exercises tab when the exercise has no rep range of its own. */
export const WORKING_REPS = 8;
