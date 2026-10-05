import {
  addProgramExercise,
  createProgram,
  deleteProgram,
  removeProgramExercise,
  updateProgram,
  updateProgramExercise,
} from "@/app/actions";
import { ExerciseSearch } from "@/components/exercise-search";
import { SubmitButton } from "@/components/submit-button";
import { CATEGORY_LABEL } from "@/lib/labels";
import { PROGRAM_GROUPS, groupProgramExercises } from "@/lib/programs";
import type { Enums } from "@/lib/supabase/database.types";

type Cat = Enums<"muscle_category">;

export type CatalogExercise = { id: string; name: string; category: Cat };

const inp = "rounded-lg border border-border bg-surface px-3 py-2 text-sm";
const small =
  "w-14 rounded-md border border-border bg-surface px-1 py-1 text-center text-sm";

type Targets = Record<string, number>;

export type EditableProgram = {
  id: string;
  name: string;
  description: string | null;
  weeks: number;
  program_targets: { category: Enums<"muscle_category">; sets: number }[];
  program_exercises: {
    id: string;
    sort: number;
    sets: number | null;
    rep_min: number | null;
    rep_max: number | null;
    exercises: CatalogExercise | null;
  }[];
};

const dangerSm =
  "rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-300";

/** The exercises a program is built from: grouped by muscle group, each with
 *  optional sets / rep range, plus a picker to add more from the catalog. */
function ProgramExercises({
  program,
  catalog,
}: {
  program: EditableProgram;
  catalog: CatalogExercise[];
}) {
  const groups = groupProgramExercises(program.program_exercises);
  const taken = new Set(program.program_exercises.map((r) => r.exercises?.id));
  const available = catalog.filter((c) => !taken.has(c.id));
  const byCat = new Map<Cat, CatalogExercise[]>();
  for (const c of available) {
    const arr = byCat.get(c.category) ?? [];
    arr.push(c);
    byCat.set(c.category, arr);
  }
  const catOrder = [...byCat.keys()].sort((a, b) =>
    CATEGORY_LABEL[a].localeCompare(CATEGORY_LABEL[b]),
  );

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <span className="text-sm font-medium">Exercises</span>

      {groups.length === 0 && (
        <p className="text-xs text-text-muted">
          None yet — add exercises below. Members see them grouped by muscle
          group.
        </p>
      )}

      {groups.map((g) => (
        <div key={g.category} className="flex flex-col gap-1.5">
          <span className="text-xs text-text-muted">
            {CATEGORY_LABEL[g.category]}
          </span>
          {g.rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2">
              <form
                action={updateProgramExercise}
                className="flex flex-1 flex-wrap items-center gap-1.5"
              >
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="program_id" value={program.id} />
                <span className="min-w-[8rem] flex-1 text-sm">
                  {r.exercises?.name}
                </span>
                <input
                  name="sets"
                  inputMode="numeric"
                  defaultValue={r.sets ?? ""}
                  placeholder="sets"
                  className={small}
                />
                <span className="text-text-muted">×</span>
                <input
                  name="rep_min"
                  inputMode="numeric"
                  defaultValue={r.rep_min ?? ""}
                  placeholder="min"
                  className={small}
                />
                <span className="text-text-muted">–</span>
                <input
                  name="rep_max"
                  inputMode="numeric"
                  defaultValue={r.rep_max ?? ""}
                  placeholder="max"
                  className={small}
                />
                <SubmitButton
                  pendingText="…"
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-50"
                >
                  Save
                </SubmitButton>
              </form>
              <form action={removeProgramExercise}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="program_id" value={program.id} />
                <SubmitButton pendingText="…" className={dangerSm}>
                  Remove
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      ))}

      {/* same search + collapsible muscle-group list as the Exercises tab;
          tapping an exercise adds it. Each row is its own form so pressing
          Enter in the search box can't submit anything. */}
      <span className="text-xs text-text-muted">
        Add from the catalog — search, or open a muscle group and tap an
        exercise.
      </span>
      <ExerciseSearch>
        {catOrder.map((c) => (
          <details
            key={c}
            data-exercise-group
            className="rounded-xl border border-border"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-semibold">
              {CATEGORY_LABEL[c]}
              <span className="text-xs font-normal text-text-muted">
                {byCat.get(c)!.length} ▾
              </span>
            </summary>
            <ul className="flex flex-col gap-1 border-t border-border p-2">
              {byCat.get(c)!.map((e) => (
                <li
                  key={e.id}
                  data-exercise-name={e.name}
                  className="rounded-lg border border-border"
                >
                  <form action={addProgramExercise}>
                    <input
                      type="hidden"
                      name="program_id"
                      value={program.id}
                    />
                    <input type="hidden" name="exercise_id" value={e.id} />
                    <SubmitButton
                      pendingText="Adding…"
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
                    >
                      <span>{e.name}</span>
                      <span className="text-xs text-text-muted">+ Add</span>
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        ))}
        {catOrder.length === 0 && (
          <p className="text-xs text-text-muted">
            Every catalog exercise is already in this program.
          </p>
        )}
      </ExerciseSearch>
      <p className="text-[11px] text-text-muted">
        Sets and reps are optional notes — leave them blank if the exercise just
        belongs in the program.
      </p>
    </div>
  );
}

function ProgramFields({
  values,
}: {
  values?: {
    name: string;
    description: string | null;
    weeks: number;
    targets: Targets;
  };
}) {
  return (
    <>
      <input
        name="name"
        required
        defaultValue={values?.name}
        placeholder="Program name"
        className={inp}
      />
      <textarea
        name="description"
        rows={2}
        defaultValue={values?.description ?? ""}
        placeholder="What it is, who it’s for…"
        className={inp}
      />
      <label className="flex items-center gap-2 text-sm text-text-muted">
        Runs for
        <input
          name="weeks"
          inputMode="numeric"
          defaultValue={values?.weeks ?? 8}
          className={small}
        />
        weeks
      </label>
      <div>
        <span className="text-xs text-text-muted">
          Sets per week, per muscle group (blank or 0 = no target)
        </span>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {PROGRAM_GROUPS.map((g) => (
            <label
              key={g}
              className="flex items-center justify-between gap-2 text-sm"
            >
              {CATEGORY_LABEL[g]}
              <input
                name={`target_${g}`}
                inputMode="numeric"
                defaultValue={values?.targets[g] || ""}
                className={small}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

/** Admin-only: create, edit and delete programs. Rendered inline at the top of
 *  the Programs tab (like the add-an-exercise form on the Exercises tab). */
export function ProgramEditor({
  programs,
  catalog,
}: {
  programs: EditableProgram[];
  catalog: CatalogExercise[];
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
          <ProgramFields />
          <SubmitButton
            pendingText="Creating…"
            className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
          >
            Create program
          </SubmitButton>
        </form>

        {programs.length > 0 && (
          <ul className="flex flex-col gap-2">
            {programs.map((p) => {
              const targets: Targets = Object.fromEntries(
                p.program_targets.map((t) => [t.category, t.sets]),
              );
              return (
                <li key={p.id} className="rounded-xl border border-border">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-text-muted">
                        {p.weeks} weeks ▾
                      </span>
                    </summary>
                    <div className="flex flex-col gap-3 border-t border-border p-3">
                      <form
                        action={updateProgram}
                        className="flex flex-col gap-3"
                      >
                        <input type="hidden" name="program_id" value={p.id} />
                        <ProgramFields
                          values={{
                            name: p.name,
                            description: p.description,
                            weeks: p.weeks,
                            targets,
                          }}
                        />
                        <SubmitButton
                          pendingText="Saving…"
                          className="self-start rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50"
                        >
                          Save changes
                        </SubmitButton>
                      </form>
                      <ProgramExercises program={p} catalog={catalog} />
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
                          Also stops it for anyone following it.
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
