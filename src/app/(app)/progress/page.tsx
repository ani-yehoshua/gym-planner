import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logBodyweight } from "@/app/actions";
import { startOfWeek } from "@/lib/date";
import { getUserToday } from "@/lib/user-today";
import { HistoryList, type HistoryDay } from "@/components/history-list";

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const todayISO = await getUserToday();

  const { data: bw } = await supabase
    .from("bodyweight_logs")
    .select("date, weight")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(14);

  const { data: sets } = await supabase
    .from("set_logs")
    .select(
      "weight, reps, logged_at, planned_day_exercises(exercises(name))",
    )
    .eq("user_id", user.id)
    .not("weight", "is", null)
    .not("reps", "is", null)
    .order("logged_at", { ascending: false })
    .limit(200);

  // best weight per exercise
  const best = new Map<string, { weight: number; reps: number }>();
  for (const s of sets ?? []) {
    const name = s.planned_day_exercises?.exercises?.name;
    if (!name || s.weight == null || s.reps == null) continue;
    const cur = best.get(name);
    if (!cur || s.weight > cur.weight) best.set(name, { weight: s.weight, reps: s.reps });
  }
  const prs = [...best.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const bwMax = Math.max(1, ...(bw ?? []).map((b) => b.weight));
  const bwMin = Math.min(bwMax, ...(bw ?? []).map((b) => b.weight));

  // ---- history: past days where you logged something ----------------------
  const { data: pastDays } = await supabase
    .from("planned_days")
    .select(
      "id, date, category, party_id, parties(name), planned_day_exercises(id, exercises(name))",
    )
    .lte("date", todayISO)
    .order("date", { ascending: false })
    .limit(60);

  const pastPdeIds = (pastDays ?? []).flatMap((d) =>
    d.planned_day_exercises.map((p) => p.id),
  );
  const { data: pastLogs } = pastPdeIds.length
    ? await supabase
        .from("set_logs")
        .select("planned_day_exercise_id, set_no, weight, reps")
        .eq("user_id", user.id)
        .in("planned_day_exercise_id", pastPdeIds)
        .order("set_no")
    : { data: [] };

  const logsByPde = new Map<
    string,
    { set_no: number; weight: number | null; reps: number | null }[]
  >();
  for (const l of pastLogs ?? []) {
    const arr = logsByPde.get(l.planned_day_exercise_id) ?? [];
    arr.push(l);
    logsByPde.set(l.planned_day_exercise_id, arr);
  }

  const history: HistoryDay[] = (pastDays ?? [])
    .map((d) => {
      let volume = 0;
      let topWeight = 0;
      let topName = "";
      const exercises: HistoryDay["exercises"] = [];

      for (const pde of d.planned_day_exercises) {
        const done = (logsByPde.get(pde.id) ?? []).filter(
          (l) => l.weight != null && l.reps != null,
        );
        if (done.length === 0) continue;
        let exVol = 0;
        let exTop = 0;
        for (const l of done) {
          exVol += l.weight! * l.reps!;
          if (l.weight! > exTop) exTop = l.weight!;
        }
        volume += exVol;
        if (exTop > topWeight) {
          topWeight = exTop;
          topName = pde.exercises?.name ?? "";
        }
        exercises.push({
          name: pde.exercises?.name ?? "?",
          sets: done.map((l) => ({ weight: l.weight!, reps: l.reps! })),
          volume: exVol,
          top: exTop,
        });
      }

      return {
        id: d.id,
        date: d.date,
        category: d.category,
        partyName: d.party_id ? (d.parties?.name ?? "Party") : null,
        volume,
        exercisesDone: exercises.length,
        top: topWeight ? `${topName} ${topWeight}` : null,
        exercises,
      };
    })
    .filter((d) => d.exercisesDone > 0)
    .slice(0, 60);

  // group history into Sun–Sat weeks: weeks newest-first, days within a week
  // in chronological (ascending) order
  const weeks: { start: string; days: HistoryDay[] }[] = [];
  for (const d of history) {
    const ws = startOfWeek(d.date);
    const bucket = weeks.find((w) => w.start === ws);
    if (bucket) bucket.days.push(d);
    else weeks.push({ start: ws, days: [d] });
  }
  for (const w of weeks) w.days.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Progress</h1>

      <section className="rounded-xl border border-border p-4">
        <h2 className="text-sm font-medium">Bodyweight</h2>
        <form action={logBodyweight} className="mt-3 flex flex-wrap gap-2">
          <input
            type="date"
            name="date"
            defaultValue={todayISO}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.1"
            name="weight"
            required
            placeholder="Weight"
            className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg">
            Log
          </button>
        </form>

        {(bw ?? []).length > 0 && (
          <ul className="mt-4 flex flex-col gap-1">
            {[...(bw ?? [])].reverse().map((b) => (
              <li key={b.date} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-text-muted">{b.date.slice(5)}</span>
                <span className="flex-1">
                  <span
                    className="inline-block h-2 rounded bg-emerald-500/60"
                    style={{
                      width: `${
                        bwMax === bwMin
                          ? 100
                          : 20 + (70 * (b.weight - bwMin)) / (bwMax - bwMin)
                      }%`,
                    }}
                  />
                </span>
                <span className="w-12 text-right text-text-muted">{b.weight}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">History</h2>
        <p className="mb-2 text-xs text-text-muted">
          Tick 2–4 days to compare them.
        </p>
        {weeks.length === 0 ? (
          <p className="text-sm text-text-muted">
            Completed days show up here once you&apos;ve logged sets on them.
          </p>
        ) : (
          <HistoryList weeks={weeks} />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Best sets</h2>
        {prs.length === 0 ? (
          <p className="text-sm text-text-muted">Log some sets and your bests show up here.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {prs.map(([name, v]) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>{name}</span>
                <span className="text-text-muted">
                  {v.weight} × {v.reps}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
