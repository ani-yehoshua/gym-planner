import { createProgram, deleteProgram, updateProgram } from "@/app/actions";
import {
  ProgramDayEditor,
  type BuilderExercise,
} from "@/components/program-day-editor";
import { SubmitButton } from "@/components/submit-button";
import { CATEGORY_LABEL, DAY_PLAN_CHOICES, dayType } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

const inp = "rounded-lg border border-border bg-surface px-3 py-2 text-sm";

export type EditableProgram = {
  id: string;
  name: string;
  description: string | null;
  category: Enums<"muscle_category"> | null;
  program_exercises: {
    id: string;
    sort: number;
    sets: number | null;
    rep_min: number | null;
    rep_max: number | null;
    exercises: BuilderExercise | null;
  }[];
};

/** Admin-only: build, edit and delete programs. A program is a saved day —
 *  built with the same controls as planning a session on the Calendar. Sits at
 *  the top of the Programs tab, like the add-an-exercise form on Exercises. */
export function ProgramEditor({
  programs,
  catalog,
}: {
  programs: EditableProgram[];
  catalog: BuilderExercise[];
}) {
  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Manage programs
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        <form
          action={createProgram}
          className="flex flex-col gap-3 rounded-xl border border-border p-3"
        >
          <span className="text-sm font-medium">New program</span>
          <input
            name="name"
            required
            placeholder="Name — e.g. Push Day"
            className={inp}
          />
          <textarea
            name="description"
            rows={2}
            placeholder="What it is, who it’s for…"
            className={inp}
          />
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Session type
            <select name="category" defaultValue="custom" className={inp}>
              {DAY_PLAN_CHOICES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton
            pendingText="Creating…"
            className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
          >
            Create program
          </SubmitButton>
          <p className="text-xs text-text-muted">
            It appears below — open it to add exercises, sets and rep ranges.
          </p>
        </form>

        {programs.length > 0 && (
          <ul className="flex flex-col gap-2">
            {programs.map((p) => {
              const rows = [...p.program_exercises]
                .sort((a, b) => a.sort - b.sort)
                .flatMap((r) =>
                  r.exercises
                    ? [
                        {
                          id: r.id,
                          sets: r.sets,
                          repMin: r.rep_min,
                          repMax: r.rep_max,
                          exercise: r.exercises,
                        },
                      ]
                    : [],
                );
              return (
                <li key={p.id} className="rounded-xl border border-border">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-text-muted">
                        {CATEGORY_LABEL[dayType(p.category)]} · {rows.length} ex ▾
                      </span>
                    </summary>
                    <div className="flex flex-col gap-4 border-t border-border p-3">
                      <form
                        action={updateProgram}
                        className="flex flex-col gap-2"
                      >
                        <input type="hidden" name="program_id" value={p.id} />
                        <input
                          name="name"
                          required
                          defaultValue={p.name}
                          className={inp}
                        />
                        <textarea
                          name="description"
                          rows={2}
                          defaultValue={p.description ?? ""}
                          placeholder="What it is, who it’s for…"
                          className={inp}
                        />
                        <SubmitButton
                          pendingText="Saving…"
                          className="self-start rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50"
                        >
                          Save name &amp; description
                        </SubmitButton>
                      </form>

                      <ProgramDayEditor
                        programId={p.id}
                        category={p.category}
                        rows={rows}
                        catalog={catalog}
                      />

                      <form
                        action={deleteProgram}
                        className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
                      >
                        <input type="hidden" name="program_id" value={p.id} />
                        <SubmitButton
                          pendingText="Deleting…"
                          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-300"
                        >
                          Delete program
                        </SubmitButton>
                        <span className="text-[11px] text-text-muted">
                          Days already planned from it keep their exercises.
                        </span>
                      </form>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
