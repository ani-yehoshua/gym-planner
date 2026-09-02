import { createExercise, updateExercise } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  COMMON_MUSCLES,
  muscleLabel,
} from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

const inp = "rounded-lg border border-border bg-surface px-3 py-2 text-sm";

export type ExerciseFormValues = {
  id: string;
  name: string;
  category: Enums<"muscle_category">;
  primary_muscles: string[];
  secondary_muscles: string[];
  howto_text: string | null;
  media_url: string | null;
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
          {CATEGORY_ORDER.filter((c) => c !== "rest").map((c) => (
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
