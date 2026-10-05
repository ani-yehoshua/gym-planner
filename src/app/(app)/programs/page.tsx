import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stopProgram } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ProgramEditor } from "@/components/program-editor";
import { isAdmin } from "@/lib/admin";
import { ProgramCard, targetChips } from "@/components/program-card";
import {
  addDays,
  dayOfMonth,
  dowShort,
  formatRangeNumeric,
  formatShort,
} from "@/lib/date";
import { getUserToday } from "@/lib/user-today";
import { CATEGORY_LABEL } from "@/lib/labels";
import {
  PROGRAM_GROUPS,
  clampWeek,
  programWeekNo,
  programWeekStart,
} from "@/lib/programs";

function Bar({ pct, done }: { pct: number; done?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-emerald-500/60"}`}
        style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
      />
    </div>
  );
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const todayISO = await getUserToday();

  const [{ data: programs }, { data: mine }, admin] = await Promise.all([
    supabase
      .from("programs")
      .select(
        "id, name, description, weeks, program_targets(category, sets), program_exercises(id, sort, sets, rep_min, rep_max, exercises(id, name, category))",
      )
      .order("created_at"),
    supabase
      .from("user_programs")
      .select("program_id, start_date")
      .eq("user_id", user.id)
      .maybeSingle(),
    isAdmin(supabase),
  ]);
  const all = programs ?? [];
  // the exercise picker in the admin editor — only admins need the catalog
  const { data: catalog } = admin
    ? await supabase
        .from("exercises")
        .select("id, name, category")
        .is("archived_at", null)
        .order("name")
    : { data: [] };
  const active = mine ? all.find((p) => p.id === mine.program_id) : undefined;

  // ---- tracker for the program being followed ------------------------------
  let tracker: React.ReactNode = null;
  if (active && mine) {
    const total = active.weeks;
    const start = mine.start_date;
    const currentRaw = programWeekNo(start, todayISO);
    const currentWeek = clampWeek(currentRaw, total);
    const viewWeek = clampWeek(Number(weekParam) || currentWeek, total);
    const notStarted = currentRaw < 1;
    const finished = currentRaw > total;

    const targets = new Map(
      targetChips(active).map((c) => [c.category, c.sets]),
    );
    const weeklyTarget = [...targets.values()].reduce((a, b) => a + b, 0);

    // every set I logged on a planned day inside the program's span, counted
    // per day per muscle group (the exercise's category). Party-mates' logs are
    // visible through RLS, so they're filtered out here.
    const first = programWeekStart(start, 1);
    const last = addDays(programWeekStart(start, total), 6);
    const { data: days } = await supabase
      .from("planned_days")
      .select(
        "date, planned_day_exercises(exercises(category), set_logs(user_id, reps, distance))",
      )
      .gte("date", first)
      .lte("date", last);

    const byDay = new Map<string, Map<string, number>>();
    for (const d of days ?? []) {
      for (const pde of d.planned_day_exercises) {
        const cat = pde.exercises?.category;
        if (!cat) continue;
        for (const l of pde.set_logs) {
          if (l.user_id !== user.id) continue;
          if (l.reps == null && l.distance == null) continue;
          const m = byDay.get(d.date) ?? new Map<string, number>();
          m.set(cat, (m.get(cat) ?? 0) + 1);
          byDay.set(d.date, m);
        }
      }
    }

    const weekDays = (w: number) =>
      Array.from({ length: 7 }, (_, i) => addDays(programWeekStart(start, w), i));
    const weekLogged = (w: number) => {
      const out = new Map<string, number>();
      for (const day of weekDays(w))
        for (const [cat, n] of byDay.get(day) ?? [])
          out.set(cat, (out.get(cat) ?? 0) + n);
      return out;
    };
    // a group over its target doesn't make up for a group that's short
    const weekCapped = (w: number) => {
      const logged = weekLogged(w);
      let sum = 0;
      for (const [cat, t] of targets) sum += Math.min(logged.get(cat) ?? 0, t);
      return sum;
    };

    const weekPcts = Array.from({ length: total }, (_, i) =>
      weeklyTarget ? weekCapped(i + 1) / weeklyTarget : 0,
    );
    const overall = weeklyTarget
      ? weekPcts.reduce((a, b) => a + b, 0) / total
      : 0;

    const viewStart = programWeekStart(start, viewWeek);
    const logged = weekLogged(viewWeek);
    const isFuture = viewWeek > currentRaw;
    const tone =
      viewWeek === currentWeek && !finished && !notStarted
        ? "This week"
        : isFuture
          ? "Upcoming"
          : "Past";

    const weekHref = (n: number) => `/programs?week=${n}`;

    tracker = (
      <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-text-muted">Following</div>
            <Link
              href={`/programs/${active.id}`}
              className="text-base font-semibold hover:underline"
            >
              {active.name}
            </Link>
          </div>
          <span className="shrink-0 text-xs text-text-muted">
            {finished
              ? "Complete"
              : notStarted
                ? `Starts ${formatShort(start)}`
                : `Week ${currentWeek} of ${total}`}
          </span>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs text-text-muted">
            <span>Whole program</span>
            <span className="text-text">{Math.round(overall * 100)}%</span>
          </div>
          <Bar pct={overall} done={overall >= 1} />
        </div>

        {/* week navigation */}
        <div className="flex items-center justify-between">
          {viewWeek > 1 ? (
            <Link
              href={weekHref(viewWeek - 1)}
              className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
            >
              ←
            </Link>
          ) : (
            <span className="px-2.5 py-1 text-sm text-text-muted opacity-30">←</span>
          )}
          <div className="text-center">
            <div className="text-sm font-medium">
              Week {viewWeek} of {total}
              <span className="ml-2 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-normal text-text-muted">
                {tone}
              </span>
            </div>
            <div className="text-xs text-text-muted">
              {formatRangeNumeric(viewStart, addDays(viewStart, 6))}
            </div>
          </div>
          {viewWeek < total ? (
            <Link
              href={weekHref(viewWeek + 1)}
              className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
            >
              →
            </Link>
          ) : (
            <span className="px-2.5 py-1 text-sm text-text-muted opacity-30">→</span>
          )}
        </div>
        {viewWeek !== currentWeek && (
          <Link
            href="/programs"
            className="-mt-2 self-center text-xs text-accent hover:underline"
          >
            Jump to {finished ? "the last" : notStarted ? "the first" : "this"} week
          </Link>
        )}

        {/* this week, per muscle group */}
        <div className="flex flex-col gap-2.5">
          {PROGRAM_GROUPS.filter((g) => targets.has(g)).map((g) => {
            const t = targets.get(g)!;
            const n = logged.get(g) ?? 0;
            return (
              <div key={g}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span>{CATEGORY_LABEL[g]}</span>
                  <span className="text-xs text-text-muted">
                    <span className="text-text">{n}</span> / {t} sets
                    {n >= t && " ✓"}
                  </span>
                </div>
                <Bar pct={t ? n / t : 0} done={n >= t} />
              </div>
            );
          })}
          {targets.size === 0 && (
            <p className="text-sm text-text-muted">
              This program has no weekly set targets yet.
            </p>
          )}
        </div>

        {/* day by day */}
        <div>
          <div className="mb-1.5 text-xs text-text-muted">Day by day</div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays(viewWeek).map((day) => {
              const m = byDay.get(day);
              const n = m ? [...m.values()].reduce((a, b) => a + b, 0) : 0;
              const isToday = day === todayISO;
              return (
                <div
                  key={day}
                  className={`flex flex-col items-center rounded-lg border px-1 py-1.5 text-center ${
                    isToday ? "border-text" : "border-border"
                  }`}
                >
                  <span className="text-[10px] uppercase text-text-muted">
                    {dowShort(day)}
                  </span>
                  <span className="text-xs">{dayOfMonth(day)}</span>
                  <span
                    className={`mt-0.5 text-sm font-semibold ${n ? "" : "text-text-muted"}`}
                  >
                    {n || "–"}
                  </span>
                </div>
              );
            })}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-text-muted">
              Sets by muscle group, per day
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1 text-xs">
              {weekDays(viewWeek).map((day) => {
                const m = byDay.get(day);
                return (
                  <li key={day} className="flex gap-2">
                    <span className="w-14 shrink-0 text-text-muted">
                      {dowShort(day)} {dayOfMonth(day)}
                    </span>
                    <span>
                      {m && m.size
                        ? PROGRAM_GROUPS.filter((g) => m.has(g))
                            .map((g) => `${CATEGORY_LABEL[g]} ${m.get(g)}`)
                            .join(" · ")
                        : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        </div>

        {/* every week at a glance */}
        <div>
          <div className="mb-1.5 text-xs text-text-muted">All weeks</div>
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {weekPcts.map((p, i) => {
              const n = i + 1;
              return (
                <Link
                  key={n}
                  href={weekHref(n)}
                  className={`flex flex-col gap-1 rounded-md border px-1.5 py-1 text-center text-[11px] ${
                    n === viewWeek ? "border-text" : "border-border"
                  } ${n > currentRaw ? "text-text-muted" : ""} hover:bg-surface`}
                >
                  <span>W{n}</span>
                  <Bar pct={p} done={p >= 1} />
                </Link>
              );
            })}
          </div>
        </div>

        <form action={stopProgram} className="self-start">
          <SubmitButton
            pendingText="…"
            className="text-xs text-text-muted hover:text-rose-400 disabled:opacity-50"
          >
            Stop following this program
          </SubmitButton>
        </form>
      </section>
    );
  }

  const others = all.filter((p) => p.id !== active?.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Programs</h1>

      {admin && <ProgramEditor programs={all} catalog={catalog ?? []} />}

      {tracker}

      {all.length === 0 ? (
        <p className="text-sm text-text-muted">
          No programs yet.{admin && " Use “Manage programs” above to add one."}
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-text-muted">
            {active ? "Other programs" : "Pick a program to follow"}
          </h2>
          {others.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </section>
      )}
    </div>
  );
}
