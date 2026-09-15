import type { Enums } from "./supabase/database.types";

export type Unit = Enums<"unit_system">; // "lb" | "kg" -- doubles as imperial/metric

/** Weights are stored as raw numbers in whichever unit the user picked — the
 *  app never converts. This is just the label to show next to them. */
export function unitLabel(u: Unit | null | undefined): string {
  return u === "kg" ? "kg" : "lb";
}

/** The distance unit that goes with a weight unit: imperial -> miles,
 *  metric -> kilometers. Same never-convert rule as weight. */
export function distanceUnitLabel(u: Unit | null | undefined): string {
  return u === "kg" ? "km" : "mi";
}

export type Measurement = Enums<"exercise_measurement">;
export type LogMode = "time" | "distance";
