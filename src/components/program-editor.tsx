import { createProgram, deleteProgram, updateProgram } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { CATEGORY_LABEL } from "@/lib/labels";
import { PROGRAM_GROUPS } from "@/lib/programs";
import type { Enums } from "@/lib/supabase/database.types";

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
};

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
export function ProgramEditor({ programs }: { programs: EditableProgram[] }) {
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
                      <form action={deleteProgram}>
                        <input type="hidden" name="program_id" value={p.id} />
                        <SubmitButton
                          pendingText="…"
                          className="text-xs text-text-muted hover:text-rose-400 disabled:opacity-50"
                        >
                          Delete this program (also stops it for anyone
                          following it)
                        </SubmitButton>
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
