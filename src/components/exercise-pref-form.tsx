"use client";

import { setExercisePref } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export type ExercisePref = {
  default_sets: number | null;
  default_rep_min: number | null;
  default_rep_max: number | null;
  default_weight: number | null;
};

const box =
  "w-14 rounded-md border border-border bg-surface px-1 py-1 text-center text-sm outline-none focus:border-text-muted";

export function ExercisePrefForm({
  exerciseId,
  pref,
  fallback,
}: {
  exerciseId: string;
  pref: ExercisePref | null;
  fallback: { sets: number | null; repMin: number | null; repMax: number | null };
}) {
  return (
    <form
      action={setExercisePref}
      className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3"
    >
      <input type="hidden" name="exercise_id" value={exerciseId} />
      <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase text-text-muted">Your defaults</span>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <input
            name="default_sets"
            inputMode="numeric"
            defaultValue={pref?.default_sets ?? ""}
            placeholder={String(fallback.sets ?? 2)}
            className={box}
          />
          <span className="text-text-muted">sets ×</span>
          <input
            name="default_rep_min"
            inputMode="numeric"
            defaultValue={pref?.default_rep_min ?? ""}
            placeholder={String(fallback.repMin ?? "")}
            className={box}
          />
          <span className="text-text-muted">–</span>
          <input
            name="default_rep_max"
            inputMode="numeric"
            defaultValue={pref?.default_rep_max ?? ""}
            placeholder={String(fallback.repMax ?? "")}
            className={box}
          />
          <span className="text-text-muted">reps @</span>
          <input
            name="default_weight"
            inputMode="decimal"
            defaultValue={pref?.default_weight ?? ""}
            placeholder="wt"
            className={box}
          />
          <span className="text-text-muted">current weight</span>
        </div>
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
