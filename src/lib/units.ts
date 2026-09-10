import type { Enums } from "./supabase/database.types";

export type Unit = Enums<"unit_system">; // "lb" | "kg"

/** Weights are stored as raw numbers in whichever unit the user picked — the
 *  app never converts. This is just the label to show next to them. */
export function unitLabel(u: Unit | null | undefined): string {
  return u === "kg" ? "kg" : "lb";
}
