import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startProgram, stopProgram } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ChevronLeftIcon } from "@/components/icons";
import { targetChips } from "@/components/program-card";
import { addDays, formatRangeNumeric } from "@/lib/date";
import { getUserToday } from "@/lib/user-today";
import { CATEGORY_LABEL } from "@/lib/labels";
import { clampWeek, programWeekNo, programWeekStart } from "@/lib/programs";

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
  const [{ data: program }, { data: mine }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, name, description, weeks, program_targets(category, sets)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("user_programs")
      .select("program_id, start_date, programs(name)")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!program) notFound();

  const chips = targetChips(program);
  const weeklyTotal = chips.reduce((a, c) => a + c.sets, 0);
  const following = mine?.program_id === program.id;
  const followingOther = mine && !following;
  const currentWeek = following
    ? clampWeek(programWeekNo(mine.start_date, todayISO), program.weeks)
    : null;

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
        <h1 className="text-lg font-semibold">{program.name}</h1>
        <p className="text-xs text-text-muted">
          {program.weeks} weeks · {weeklyTotal} sets / week
        </p>
        {program.description && (
          <p className="mt-2 text-sm text-text-muted">{program.description}</p>
        )}
      </div>

      <section className="rounded-xl border border-border p-4">
        <h2 className="mb-2 text-sm font-medium">Weekly targets</h2>
        {chips.length === 0 ? (
          <p className="text-sm text-text-muted">No set targets yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {chips.map((c) => (
              <li key={c.category} className="flex justify-between">
                <span>{CATEGORY_LABEL[c.category]}</span>
                <span className="text-text-muted">
                  <span className="text-text">{c.sets}</span> sets
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border p-4">
        <h2 className="mb-2 text-sm font-medium">The whole program</h2>
        <ul className="flex flex-col divide-y divide-border text-sm">
          {Array.from({ length: program.weeks }, (_, i) => i + 1).map((w) => {
            const start = following
              ? programWeekStart(mine.start_date, w)
              : null;
            const row = (
              <>
                <span className="flex items-center gap-2">
                  Week {w}
                  {currentWeek === w && (
                    <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-300">
                      now
                    </span>
                  )}
                </span>
                <span className="text-xs text-text-muted">
                  {start
                    ? formatRangeNumeric(start, addDays(start, 6))
                    : `${weeklyTotal} sets`}
                </span>
              </>
            );
            return following ? (
              <li key={w}>
                <Link
                  href={`/programs?week=${w}`}
                  className="flex items-center justify-between py-2 hover:bg-surface"
                >
                  {row}
                </Link>
              </li>
            ) : (
              <li key={w} className="flex items-center justify-between py-2">
                {row}
              </li>
            );
          })}
        </ul>
      </section>

      {following ? (
        <div className="flex flex-col gap-2">
          <Link
            href="/programs"
            className="rounded-lg bg-primary px-3 py-2 text-center text-sm font-medium text-primary-fg"
          >
            Open tracker
          </Link>
          <form action={stopProgram} className="self-start">
            <SubmitButton
              pendingText="…"
              className="text-xs text-text-muted hover:text-rose-400 disabled:opacity-50"
            >
              Stop following this program
            </SubmitButton>
          </form>
        </div>
      ) : (
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
              defaultValue={todayISO}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </label>
          <p className="text-xs text-text-muted">
            Week 1 is the Sunday–Saturday week that includes this date. Sets you
            log count toward it automatically.
            {followingOther &&
              ` This replaces ${mine.programs?.name ?? "the program"} you're following now.`}
          </p>
          <SubmitButton
            pendingText="Starting…"
            className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
          >
            Start program
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
