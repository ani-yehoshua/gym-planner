import { createClient } from "@/lib/supabase/server";
import { createExercise } from "@/app/actions";
import { CATEGORY_LABEL, CATEGORY_ORDER, MUSCLE_LABEL } from "@/lib/labels";
import { ExerciseDetailBody } from "@/components/exercise-detail";
import type { Enums } from "@/lib/supabase/database.types";

const MUSCLES: Enums<"muscle_group">[] = [
  "chest", "back", "lats", "shoulders", "side_delts", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "abs",
];

export default async function ExercisesPage() {
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select(
      "id, name, category, primary_muscles, secondary_muscles, howto_text, media_url, created_by",
    )
    .order("category")
    .order("name");

  const grouped = new Map<Enums<"muscle_category">, NonNullable<typeof exercises>>();
  for (const e of exercises ?? []) {
    const arr = grouped.get(e.category) ?? [];
    arr.push(e);
    grouped.set(e.category, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Exercises</h1>

      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Add a custom exercise</summary>
        <form action={createExercise} className="mt-3 flex flex-col gap-3">
          <input
            name="name"
            required
            placeholder="Exercise name"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <select
            name="category"
            required
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
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
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <input
            name="media_url"
            type="url"
            placeholder="Video URL — YouTube (optional)"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <button className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg">
            Add exercise
          </button>
        </form>
      </details>

      {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => (
        <div key={c}>
          <h2 className="mb-2 text-sm font-semibold text-text-muted">{CATEGORY_LABEL[c]}</h2>
          <ul className="flex flex-col gap-1">
            {grouped.get(c)!.map((e) => (
              <li key={e.id} className="rounded-lg border border-border">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {e.name}
                      {e.created_by && (
                        <span className="ml-2 text-xs text-text-muted">custom</span>
                      )}
                    </span>
                    <span className="text-xs text-text-muted group-open:hidden">
                      {e.primary_muscles.map((m) => MUSCLE_LABEL[m]).join(", ")}
                    </span>
                  </summary>
                  <div className="border-t border-border px-3 py-3">
                    <ExerciseDetailBody ex={e} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
