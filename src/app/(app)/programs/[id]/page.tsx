import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startProgram } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ChevronLeftIcon } from "@/components/icons";
import { getUserToday } from "@/lib/user-today";
import { muscleList } from "@/lib/labels";
import {
  describeSets,
  durationLabel,
  parseSetReps,
  programTotalDays,
} from "@/lib/programs";

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { id } = await params;
  const { start } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const todayISO = await getUserToday();
  const [{ data: program }, { data: run }] = await Promise.all([
    supabase
      .from("programs")
      .select(
        "id, name, description, duration_unit, duration_count, program_days(id, position, name, is_rest, program_exercises(id, sort, sets, rep_min, rep_max, set_reps, exercises(id, name, primary_muscles, time_based, default_sets, default_rep_min, default_rep_max)))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("user_programs")
      .select("program_id, programs(name)")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!program) notFound();

  const days = [...program.program_days].sort((a, b) => a.position - b.position);
  const unit = program.duration_unit === "days" ? "days" : "weeks";
  const total = programTotalDays(unit, program.duration_count);
  const sessions = Array.from({ length: total }, (_, i) =>
    days.length ? days[i % days.length] : null,
  ).filter((d) => d && !d.is_rest).length;
  // arriving from a Calendar day's "Plan session…" pre-fills that date
  const defaultStart = /^\d{4}-\d{2}-\d{2}$/.test(start ?? "") ? start! : todayISO;
  const followingOther = run && run.program_id !== program.id;

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
          <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-xs text-text-muted">
            {durationLabel(program.duration_unit, program.duration_count)}
          </span>
        </div>
        <p className="text-xs text-text-muted">
          {days.length}-day cycle · {sessions} training{" "}
          {sessions === 1 ? "session" : "sessions"} over {total}{" "}
          {total === 1 ? "day" : "days"}
        </p>
        {program.description && (
          <p className="mt-2 text-sm text-text-muted">{program.description}</p>
        )}
      </div>

      {/* what the repeating cycle is made of */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">The cycle</h2>
        {days.map((d, i) => {
          const exercises = [...d.program_exercises]
            .sort((a, b) => a.sort - b.sort)
            .flatMap((e) => (e.exercises ? [{ ...e, ex: e.exercises }] : []));
          return (
            <div key={d.id} className="rounded-xl border border-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  <span className="mr-2 text-xs font-normal text-text-muted">
                    Day {i + 1}
                  </span>
                  {d.name}
                </span>
                {d.is_rest && (
                  <span className="text-xs text-text-muted">Rest</span>
                )}
              </div>
              {!d.is_rest &&
                (exercises.length === 0 ? (
                  <p className="mt-2 text-sm text-text-muted">No exercises.</p>
                ) : (
                  <ol className="mt-2 flex flex-col divide-y divide-border text-sm">
                    {exercises.map((e, j) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="w-4 shrink-0 text-xs text-text-muted">
                            {j + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block">{e.ex.name}</span>
                            <span className="block text-xs text-text-muted">
                              {muscleList(e.ex.primary_muscles)}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-text-muted">
                          {describeSets(
                            e.sets ?? e.ex.default_sets,
                            parseSetReps(e.set_reps),
                            e.rep_min ?? e.ex.default_rep_min,
                            e.rep_max ?? e.ex.default_rep_max,
                            e.ex.time_based ? "sec" : "reps",
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                ))}
            </div>
          );
        })}
      </section>

      <form
        action={startProgram}
        className="flex flex-col gap-3 rounded-xl border border-border p-4"
      >
        <input type="hidden" name="program_id" value={program.id} />
        <span className="text-sm font-medium">Start this program</span>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          Starting
          <input
            type="date"
            name="start_date"
            required
            defaultValue={defaultStart}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          />
        </label>
        <p className="text-xs text-text-muted">
          The cycle above repeats from this date for{" "}
          {durationLabel(program.duration_unit, program.duration_count)}. Every
          training day is added to your calendar with its exercises, sets and
          target reps; rest days stay empty.
          {followingOther &&
            ` This replaces ${run.programs?.name ?? "the program"} as the one you're following — days it already added stay on your calendar.`}
        </p>
        <SubmitButton
          pendingText="Loading…"
          className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          Start program
        </SubmitButton>
      </form>
    </div>
  );
}
