import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDay } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ChevronLeftIcon } from "@/components/icons";
import { getUserToday } from "@/lib/user-today";
import {
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  dayType,
  muscleList,
} from "@/lib/labels";
import { formatRx, programChoiceValue } from "@/lib/programs";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const todayISO = await getUserToday();
  const { data: program } = await supabase
    .from("programs")
    .select(
      "id, name, description, category, program_exercises(id, sort, sets, rep_min, rep_max, exercises(id, name, primary_muscles, time_based, default_sets, default_rep_min, default_rep_max))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!program) notFound();

  const type = dayType(program.category);
  const rows = [...program.program_exercises]
    .sort((a, b) => a.sort - b.sort)
    .flatMap((r) => (r.exercises ? [{ ...r, ex: r.exercises }] : []));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/programs"
        className="flex items-center gap-1 text-sm text-text-muted hover:text-text"
      >
        <ChevronLeftIcon />
        Programs
      </Link>

      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-semibold">{program.name}</h1>
          <span
            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-xs ${CATEGORY_STYLE[type]}`}
          >
            {CATEGORY_LABEL[type]}
          </span>
        </div>
        {program.description && (
          <p className="mt-2 text-sm text-text-muted">{program.description}</p>
        )}
      </div>

      <section className="rounded-xl border border-border p-4">
        <h2 className="mb-2 text-sm font-medium">
          Exercises
          <span className="ml-2 text-xs font-normal text-text-muted">
            {rows.length}
          </span>
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-text-muted">No exercises yet.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border text-sm">
            {rows.map((r, i) => {
              // sets/reps the program leaves blank are whatever the exercise
              // itself defaults to
              const rx = formatRx(
                r.sets ?? r.ex.default_sets,
                r.rep_min ?? r.ex.default_rep_min,
                r.rep_max ?? r.ex.default_rep_max,
                r.ex.time_based ? "sec" : "reps",
              );
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="w-4 shrink-0 text-xs text-text-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block">{r.ex.name}</span>
                      <span className="block text-xs text-text-muted">
                        {muscleList(r.ex.primary_muscles)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-text-muted">{rx}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* posts straight to the same action as the Calendar's "Plan session…" */}
      <form
        action={createDay}
        className="flex flex-col gap-3 rounded-xl border border-border p-4"
      >
        <input
          type="hidden"
          name="category"
          value={programChoiceValue(program.id)}
        />
        <span className="text-sm font-medium">Plan this session</span>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          On
          <input
            type="date"
            name="date"
            required
            defaultValue={todayISO}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          />
        </label>
        <p className="text-xs text-text-muted">
          Adds it to your calendar with these exercises, sets and rep ranges
          filled in. You can still change anything on the day afterwards.
        </p>
        <SubmitButton
          pendingText="Planning…"
          className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          Plan session
        </SubmitButton>
      </form>
    </div>
  );
}
