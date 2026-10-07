import { deleteProgram } from "@/app/actions";
import {
  ProgramBuilder,
  type BuilderExercise,
  type InitialProgram,
} from "@/components/program-builder";
import { SubmitButton } from "@/components/submit-button";
import {
  durationLabel,
  parseSetReps,
  type DurationUnit,
} from "@/lib/programs";

export type EditableProgram = {
  id: string;
  name: string;
  description: string | null;
  duration_unit: string;
  duration_count: number;
  program_days: {
    id: string;
    position: number;
    name: string;
    is_rest: boolean;
    program_exercises: {
      id: string;
      sort: number;
      sets: number | null;
      rep_min: number | null;
      rep_max: number | null;
      set_reps: unknown;
      superset_group: number | null;
      exercises: BuilderExercise | null;
    }[];
  }[];
};

function toInitial(p: EditableProgram): InitialProgram {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    durationUnit: (p.duration_unit === "days" ? "days" : "weeks") as DurationUnit,
    durationCount: p.duration_count,
    days: [...p.program_days]
      .sort((a, b) => a.position - b.position)
      .map((d) => ({
        name: d.name,
        isRest: d.is_rest,
        exercises: [...d.program_exercises]
          .sort((a, b) => a.sort - b.sort)
          .flatMap((e) =>
            e.exercises
              ? [
                  {
                    exercise: e.exercises,
                    sets: e.sets,
                    // older rows only have one overall range: it applies to every set
                    setReps: parseSetReps(e.set_reps).length
                      ? parseSetReps(e.set_reps)
                      : e.rep_min != null || e.rep_max != null
                        ? [{ min: e.rep_min, max: e.rep_max }]
                        : [],
                    supersetGroup: e.superset_group,
                  },
                ]
              : [],
          ),
      })),
  };
}

/** Admin-only: build, edit and delete programs. Sits at the top of the Programs
 *  tab, like the add-an-exercise form on the Exercises tab. */
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
        <div className="rounded-xl border border-border p-3">
          <span className="mb-3 block text-sm font-medium">New program</span>
          <ProgramBuilder catalog={catalog} />
        </div>

        {programs.length > 0 && (
          <ul className="flex flex-col gap-2">
            {programs.map((p) => (
              <li key={p.id} className="rounded-xl border border-border">
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {durationLabel(p.duration_unit, p.duration_count)} ▾
                    </span>
                  </summary>
                  <div className="flex flex-col gap-4 border-t border-border p-3">
                    <ProgramBuilder initial={toInitial(p)} catalog={catalog} />
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
                        Days already on a calendar keep their exercises.
                      </span>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
