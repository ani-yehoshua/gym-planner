import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import {
  addSplitExercise,
  createSplitTemplate,
  deleteSplitTemplate,
  removeSplitExercise,
  reorderSplitExercise,
  saveSplitSlots,
  updateSplitExercise,
  updateSplitTemplate,
} from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ChevronLeftIcon } from "@/components/icons";
import {
  CATEGORY_LABEL,
  DAY_ACCEPTS,
  DAY_CATEGORY_CHOICES,
} from "@/lib/labels";
import Link from "next/link";
import type { Enums } from "@/lib/supabase/database.types";

const inp = "rounded-lg border border-border bg-surface px-3 py-2 text-sm";
const small = "w-14 rounded-md border border-border bg-surface px-1 py-1 text-center text-sm";
const stepBtn = "rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30";

export default async function AdminSplitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(supabase))) redirect("/exercises");

  const { data: templates } = await supabase
    .from("schedule_templates")
    .select(
      "id, name, description, default_weeks, template_days(id, position, category, template_day_exercises(id, sort, sets, rep_min, rep_max, exercises(id, name)))",
    )
    .eq("is_global", true)
    .order("name");

  const { data: catalog } = await supabase
    .from("exercises")
    .select("id, name, category")
    .is("archived_at", null)
    .order("name");
  const cat = catalog ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/exercises"
        className="flex items-center gap-1 text-sm text-text-muted hover:text-text"
      >
        <ChevronLeftIcon />
        Exercises
      </Link>
      <h1 className="text-lg font-semibold">Split presets</h1>

      <form
        action={createSplitTemplate}
        className="flex items-end gap-2 rounded-xl border border-border p-3"
      >
        <label className="flex flex-1 flex-col gap-1 text-xs text-text-muted">
          New preset
          <input name="name" required placeholder="Preset name" className={inp} />
        </label>
        <SubmitButton
          pendingText="…"
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          Create
        </SubmitButton>
      </form>

      {(templates ?? []).map((t) => {
        const slots = Array<Enums<"muscle_category">>(7).fill("rest");
        for (const d of t.template_days) {
          if (d.position >= 0 && d.position < 7) slots[d.position] = d.category;
        }
        const dayByPosition = new Map(t.template_days.map((d) => [d.position, d]));

        return (
          <details key={t.id} className="rounded-xl border border-border">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold">
              {t.name}
              <span className="ml-2 text-xs font-normal text-text-muted">
                {slots.filter((s) => s !== "rest").length} training days ▾
              </span>
            </summary>

            <div className="flex flex-col gap-4 border-t border-border p-3">
              {/* meta */}
              <form action={updateSplitTemplate} className="flex flex-col gap-2">
                <input type="hidden" name="template_id" value={t.id} />
                <input name="name" defaultValue={t.name} className={inp} />
                <input
                  name="description"
                  defaultValue={t.description ?? ""}
                  placeholder="Description"
                  className={inp}
                />
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  Default weeks
                  <input
                    name="default_weeks"
                    inputMode="numeric"
                    defaultValue={t.default_weeks}
                    className={small}
                  />
                </label>
                <SubmitButton
                  pendingText="Saving…"
                  className="self-start rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface disabled:opacity-50"
                >
                  Save details
                </SubmitButton>
              </form>

              {/* 7-slot pattern */}
              <form action={saveSplitSlots} className="flex flex-col gap-2">
                <input type="hidden" name="template_id" value={t.id} />
                <span className="text-xs font-medium text-text-muted">Week pattern</span>
                {slots.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-10 text-xs text-text-muted">Day {i + 1}</span>
                    <select name={`slot_${i}`} defaultValue={s} className={`${inp} flex-1`}>
                      <option value="rest">Rest</option>
                      {DAY_CATEGORY_CHOICES.filter((c) => c !== "rest").map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <SubmitButton
                  pendingText="Saving…"
                  className="self-start rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface disabled:opacity-50"
                >
                  Save pattern
                </SubmitButton>
              </form>

              {/* per training day exercise lists */}
              {slots
                .map((s, i) => ({ s, i, day: dayByPosition.get(i) }))
                .filter((x) => x.s !== "rest" && x.day)
                .map(({ s, i, day }) => {
                  const exs = [...day!.template_day_exercises].sort(
                    (a, b) => a.sort - b.sort,
                  );
                  const pool = cat.filter((c) => DAY_ACCEPTS[s].includes(c.category));
                  return (
                    <div
                      key={day!.id}
                      className="rounded-lg border border-border p-2"
                    >
                      <div className="mb-2 text-xs font-medium">
                        Day {i + 1} · {CATEGORY_LABEL[s]}
                      </div>
                      <ul className="flex flex-col gap-1">
                        {exs.map((e, idx) => (
                          <li
                            key={e.id}
                            className="flex flex-wrap items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-sm"
                          >
                            <span className="flex-1">{e.exercises?.name}</span>
                            <form
                              action={updateSplitExercise}
                              className="flex items-center gap-1"
                            >
                              <input type="hidden" name="tde_id" value={e.id} />
                              <input
                                name="sets"
                                inputMode="numeric"
                                defaultValue={e.sets ?? ""}
                                className={small}
                              />
                              <span className="text-xs text-text-muted">×</span>
                              <input
                                name="rep_min"
                                inputMode="numeric"
                                defaultValue={e.rep_min ?? ""}
                                className={small}
                              />
                              <span className="text-xs text-text-muted">–</span>
                              <input
                                name="rep_max"
                                inputMode="numeric"
                                defaultValue={e.rep_max ?? ""}
                                className={small}
                              />
                              <SubmitButton
                                pendingText="…"
                                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-50"
                              >
                                Save
                              </SubmitButton>
                            </form>
                            <form action={reorderSplitExercise}>
                              <input type="hidden" name="tde_id" value={e.id} />
                              <input
                                type="hidden"
                                name="template_day_id"
                                value={day!.id}
                              />
                              <input type="hidden" name="dir" value="-1" />
                              <SubmitButton
                                pendingText="…"
                                className={stepBtn}
                                disabled={idx === 0}
                              >
                                ↑
                              </SubmitButton>
                            </form>
                            <form action={reorderSplitExercise}>
                              <input type="hidden" name="tde_id" value={e.id} />
                              <input
                                type="hidden"
                                name="template_day_id"
                                value={day!.id}
                              />
                              <input type="hidden" name="dir" value="1" />
                              <SubmitButton
                                pendingText="…"
                                className={stepBtn}
                                disabled={idx === exs.length - 1}
                              >
                                ↓
                              </SubmitButton>
                            </form>
                            <form action={removeSplitExercise}>
                              <input type="hidden" name="tde_id" value={e.id} />
                              <SubmitButton
                                pendingText="…"
                                className="rounded-md border border-rose-500/40 px-2 py-1 text-xs text-rose-700 hover:bg-rose-500/10 disabled:opacity-50 dark:text-rose-300"
                              >
                                ✕
                              </SubmitButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                      <form
                        action={addSplitExercise}
                        className="mt-2 flex gap-2"
                      >
                        <input
                          type="hidden"
                          name="template_day_id"
                          value={day!.id}
                        />
                        <select name="exercise_id" required className={`${inp} flex-1`}>
                          <option value="">Add exercise…</option>
                          {pool.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <SubmitButton
                          pendingText="…"
                          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50"
                        >
                          Add
                        </SubmitButton>
                      </form>
                    </div>
                  );
                })}

              <form action={deleteSplitTemplate}>
                <input type="hidden" name="template_id" value={t.id} />
                <SubmitButton
                  pendingText="…"
                  className="text-xs text-text-muted hover:text-rose-400 disabled:opacity-50"
                >
                  Delete this preset
                </SubmitButton>
              </form>
            </div>
          </details>
        );
      })}
    </div>
  );
}
