import { createExercise } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { CATEGORY_LABEL, CATEGORY_ORDER, MUSCLE_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

const MUSCLES: Enums<"muscle_group">[] = [
  "chest", "back", "lats", "shoulders", "side_delts", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "abs",
];

const inp = "rounded-lg border border-border bg-surface px-3 py-2 text-sm";

/** Admin-only: add an exercise to the global catalog. */
export function ExerciseForm({
  defaultName,
  requestId,
  submitLabel = "Add exercise",
}: {
  defaultName?: string;
  requestId?: string;
  submitLabel?: string;
}) {
  return (
    <form action={createExercise} className="flex flex-col gap-3">
      {requestId && <input type="hidden" name="request_id" value={requestId} />}
      <input
        name="name"
        required
        defaultValue={defaultName}
        placeholder="Exercise name"
        className={inp}
      />
      <select name="category" required className={inp} defaultValue="">
        <option value="" disabled>
          Category…
        </option>
        {CATEGORY_ORDER.filter((c) => c !== "rest").map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        {MUSCLES.map((m) => (
          <label
            key={m}
            className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs has-[:checked]:border-text has-[:checked]:bg-surface-2"
          >
            <input type="checkbox" name="primary_muscles" value={m} className="sr-only" />
            {MUSCLE_LABEL[m]}
          </label>
        ))}
      </div>
      <textarea
        name="howto_text"
        placeholder="How to do it (optional)"
        rows={2}
        className={inp}
      />
      <input
        name="media_url"
        type="url"
        placeholder="Video URL — YouTube (optional)"
        className={inp}
      />
      <SubmitButton
        pendingText="Saving…"
        className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
      >
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
