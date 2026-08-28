import { createClient } from "@/lib/supabase/server";
import { createExercise } from "@/app/actions";
import { CATEGORY_LABEL, CATEGORY_ORDER, MUSCLE_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

const MUSCLES: Enums<"muscle_group">[] = [
  "chest", "back", "lats", "shoulders", "side_delts", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "abs",
];

export default async function ExercisesPage() {
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, category, primary_muscles, created_by")
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

      <details className="rounded-xl border border-zinc-800 p-3">
        <summary className="cursor-pointer text-sm font-medium">Add a custom exercise</summary>
        <form action={createExercise} className="mt-3 flex flex-col gap-3">
          <input
            name="name"
            required
            placeholder="Exercise name"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <select
            name="category"
            required
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
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
                className="cursor-pointer rounded-full border border-zinc-700 px-3 py-1 text-xs has-[:checked]:border-white has-[:checked]:bg-zinc-800"
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
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <button className="self-start rounded-lg bg-white px-3 py-2 text-sm font-medium text-black">
            Add exercise
          </button>
        </form>
      </details>

      {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => (
        <div key={c}>
          <h2 className="mb-2 text-sm font-semibold text-zinc-400">{CATEGORY_LABEL[c]}</h2>
          <ul className="flex flex-col gap-1">
            {grouped.get(c)!.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
              >
                <span>
                  {e.name}
                  {e.created_by && (
                    <span className="ml-2 text-xs text-zinc-500">custom</span>
                  )}
                </span>
                <span className="text-xs text-zinc-500">
                  {e.primary_muscles.map((m) => MUSCLE_LABEL[m]).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
