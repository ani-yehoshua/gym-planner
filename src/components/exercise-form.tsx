"use client";

import { useState } from "react";
import { createExercise, updateExercise } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CATEGORY_LABEL,
  DAY_CATEGORY_CHOICES,
  COMMON_MUSCLES,
  muscleLabel,
} from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

const inp = "rounded-lg border border-border bg-surface px-3 py-2 text-sm";
const smallInp =
  "w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm";

type Measurement = Enums<"exercise_measurement">;

const MEASUREMENT_LABEL: Record<Measurement, string> = {
  reps: "Reps (weight × reps)",
  time: "Time (holds, cardio)",
  distance: "Distance (walks, runs)",
  time_or_distance: "Time or distance (either, per session)",
};

export type ExerciseFormValues = {
  id: string;
  name: string;
  category: Enums<"muscle_category">;
  primary_muscles: string[];
  secondary_muscles: string[];
  howto_text: string | null;
  media_url: string | null;
  default_sets: number | null;
  default_rep_min: number | null;
  default_rep_max: number | null;
  default_distance: number | null;
  measurement: Measurement;
  time_based: boolean;
  weighted: boolean;
};

const toInput = (ms: string[]) => ms.map(muscleLabel).join(", ");

/** Admin-only: create or edit a catalog exercise. Pass `exercise` to edit. */
export function ExerciseForm({
  exercise,
  defaultName,
  requestId,
  submitLabel,
}: {
  exercise?: ExerciseFormValues;
  defaultName?: string;
  requestId?: string;
  submitLabel?: string;
}) {
  const editing = !!exercise;
  const action = editing ? updateExercise : createExercise;
  const [measurement, setMeasurement] = useState<Measurement>(
    exercise?.measurement ?? "reps",
  );
  const [weighted, setWeighted] = useState(exercise?.weighted ?? true);
  const timeBased = measurement === "time" || measurement === "time_or_distance";
  const distanceBased = measurement === "distance" || measurement === "time_or_distance";

  return (
    <form action={action} className="flex flex-col gap-3">
      {editing && <input type="hidden" name="exercise_id" value={exercise.id} />}
      {requestId && <input type="hidden" name="request_id" value={requestId} />}

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        Name
        <input
          name="name"
          required
          defaultValue={exercise?.name ?? defaultName}
          placeholder="Exercise name"
          className={inp}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        Muscle group
        <select
          name="category"
          required
          className={inp}
          defaultValue={exercise?.category ?? ""}
        >
          <option value="" disabled>
            Choose…
          </option>
          {DAY_CATEGORY_CHOICES.filter((c) => c !== "rest").map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>

      <datalist id="muscle-options">
        {COMMON_MUSCLES.map((m) => (
          <option key={m} value={muscleLabel(m)} />
        ))}
      </datalist>

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        Primary muscle targets (comma-separated — type any)
        <input
          name="primary_muscles"
          list="muscle-options"
          defaultValue={exercise ? toInput(exercise.primary_muscles) : ""}
          placeholder="Chest, Front Delts"
          className={inp}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        Secondary muscle targets
        <input
          name="secondary_muscles"
          list="muscle-options"
          defaultValue={exercise ? toInput(exercise.secondary_muscles) : ""}
          placeholder="Triceps, Traps"
          className={inp}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        Measurement
        <select
          name="measurement"
          value={measurement}
          onChange={(e) => setMeasurement(e.target.value as Measurement)}
          className={inp}
        >
          {Object.entries(MEASUREMENT_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-text has-[:checked]:bg-surface-2">
        <input
          type="checkbox"
          name="weighted"
          value="true"
          checked={weighted}
          onChange={(e) => setWeighted(e.target.checked)}
        />
        Weighted (uncheck for bodyweight-only moves — push-ups, hanging leg
        raise, etc.; a member can still add weight for their own version)
      </label>

      <div className="flex flex-col gap-1 text-xs text-text-muted">
        Default sets &amp; {timeBased ? "time range" : "rep range"} (used
        everywhere this exercise is added)
        <div className="flex items-center gap-1.5 text-sm">
          <input
            name="default_sets"
            inputMode="numeric"
            defaultValue={exercise?.default_sets ?? ""}
            placeholder="3"
            className={smallInp}
          />
          <span>sets ×</span>
          <input
            name="default_rep_min"
            inputMode="numeric"
            defaultValue={exercise?.default_rep_min ?? ""}
            placeholder={timeBased ? "20" : "8"}
            className={smallInp}
          />
          <span>–</span>
          <input
            name="default_rep_max"
            inputMode="numeric"
            defaultValue={exercise?.default_rep_max ?? ""}
            placeholder={timeBased ? "45" : "12"}
            className={smallInp}
          />
          <span>{timeBased ? "sec" : "reps"}</span>
        </div>
      </div>

      {distanceBased && (
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Default distance (in the member&rsquo;s unit — mi or km)
          <input
            name="default_distance"
            inputMode="decimal"
            defaultValue={exercise?.default_distance ?? ""}
            placeholder="0.5"
            className={smallInp}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        How to do it
        <textarea
          name="howto_text"
          defaultValue={exercise?.howto_text ?? ""}
          rows={3}
          className={inp}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-text-muted">
        Video URL (YouTube)
        <input
          name="media_url"
          type="url"
          defaultValue={exercise?.media_url ?? ""}
          className={inp}
        />
      </label>

      <SubmitButton
        pendingText="Saving…"
        className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
      >
        {submitLabel ?? (editing ? "Save changes" : "Add exercise")}
      </SubmitButton>
    </form>
  );
}
