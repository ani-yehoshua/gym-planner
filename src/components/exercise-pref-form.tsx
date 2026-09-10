"use client";

import { useState } from "react";
import { setExercisePref } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  epley1rm,
  round5,
  workingFrom1rm,
  WORKING_REPS,
} from "@/lib/one-rm";
import { unitLabel, type Unit } from "@/lib/units";

export type ExercisePref = {
  default_sets: number | null;
  default_rep_min: number | null;
  default_rep_max: number | null;
  default_weight: number | null;
  default_1rm: number | null;
};

const box =
  "w-14 rounded-md border border-border bg-surface px-1 py-1 text-center text-sm outline-none focus:border-text-muted";

export function ExercisePrefForm({
  exerciseId,
  pref,
  fallback,
  timeBased,
  units,
}: {
  exerciseId: string;
  pref: ExercisePref | null;
  fallback: { sets: number | null; repMin: number | null; repMax: number | null };
  timeBased?: boolean;
  units: Unit;
}) {
  const u = unitLabel(units);
  const [sets, setSets] = useState(str(pref?.default_sets));
  const [repMin, setRepMin] = useState(str(pref?.default_rep_min));
  const [repMax, setRepMax] = useState(str(pref?.default_rep_max));
  const [weight, setWeight] = useState(str(pref?.default_weight));
  const [oneRm, setOneRm] = useState(str(pref?.default_1rm));

  // reps used to convert working weight <-> 1RM via Epley: the middle of the
  // rep range if set, otherwise the goal suggestion, otherwise a default
  const lo = num(repMin) ?? fallback.repMin;
  const hi = num(repMax) ?? fallback.repMax;
  const convReps =
    lo != null && hi != null ? (lo + hi) / 2 : (lo ?? hi ?? WORKING_REPS);

  function syncFromWeight() {
    const w = num(weight);
    if (w != null && w > 0) setOneRm(String(round5(epley1rm(w, convReps))));
  }
  function syncFrom1rm() {
    const o = num(oneRm);
    if (o != null && o > 0)
      setWeight(String(round5(workingFrom1rm(o, convReps))));
  }

  return (
    <form
      action={setExercisePref}
      className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3"
    >
      <input type="hidden" name="exercise_id" value={exerciseId} />
      <div className="flex flex-col gap-2">
        <span className="text-[11px] uppercase text-text-muted">Your defaults</span>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <input
            name="default_sets"
            inputMode="numeric"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            placeholder={String(fallback.sets ?? 2)}
            className={box}
          />
          <span className="text-text-muted">sets ×</span>
          <input
            name="default_rep_min"
            inputMode="numeric"
            value={repMin}
            onChange={(e) => setRepMin(e.target.value)}
            placeholder={String(fallback.repMin ?? "")}
            className={box}
          />
          <span className="text-text-muted">–</span>
          <input
            name="default_rep_max"
            inputMode="numeric"
            value={repMax}
            onChange={(e) => setRepMax(e.target.value)}
            placeholder={String(fallback.repMax ?? "")}
            className={box}
          />
          <span className="text-text-muted">
            {timeBased ? "sec @" : "reps @"}
          </span>
          <input
            name="default_weight"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={syncFromWeight}
            placeholder="wt"
            className={box}
          />
          <span className="text-text-muted">working weight ({u})</span>
        </div>

        {!timeBased && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <input
              name="default_1rm"
              inputMode="decimal"
              value={oneRm}
              onChange={(e) => setOneRm(e.target.value)}
              onBlur={syncFrom1rm}
              placeholder="—"
              className={box}
            />
            <span className="text-text-muted">
              est. 1RM ({u}) — kept in sync with working weight via Epley
            </span>
          </div>
        )}
      </div>

      <SubmitButton
        pendingText="Saving…"
        className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface disabled:opacity-50"
      >
        Save
      </SubmitButton>
      <p className="w-full text-[11px] text-text-muted">
        Prefilled whenever this exercise is added to a day. Blank fields fall back
        to the goal-based suggestion.
      </p>
    </form>
  );
}

function str(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}
function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
