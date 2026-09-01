import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logBodyweight } from "@/app/actions";
import { formatLong, today } from "@/lib/date";
import { CATEGORY_LABEL, CATEGORY_STYLE } from "@/lib/labels";

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
    .lte("date", today())
    .order("date", { ascending: false })
    .limit(60);

  const pastPdeIds = (pastDays ?? []).flatMap((d) =>
    d.planned_day_exercises.map((p) => p.id),
  );
  const { data: pastLogs } = pastPdeIds.length
    ? await supabase
        .from("set_logs")
        .select("planned_day_exercise_id, weight, reps")
        .eq("user_id", user.id)
        .in("planned_day_exercise_id", pastPdeIds)
    : { data: [] };

  const logsByPde = new Map<string, { weight: number | null; reps: number | null }[]>();
  for (const l of pastLogs ?? []) {
    const arr = logsByPde.get(l.planned_day_exercise_id) ?? [];
    arr.push(l);
    logsByPde.set(l.planned_day_exercise_id, arr);
  }

  const history = (pastDays ?? [])
    .map((d) => {
      let volume = 0;
      let topWeight = 0;
      let topName = "";
      const exercisesDone = new Set<string>();
      for (const pde of d.planned_day_exercises) {
        for (const l of logsByPde.get(pde.id) ?? []) {
          if (l.weight == null || l.reps == null) continue;
          exercisesDone.add(pde.id);
          volume += l.weight * l.reps;
          if (l.weight > topWeight) {
            topWeight = l.weight;
            topName = pde.exercises?.name ?? "";
          }
        }
      }
      return {
        id: d.id,
        date: d.date,
        category: d.category,
        partyName: d.party_id ? (d.parties?.name ?? "Party") : null,
        volume,
        exercisesDone: exercisesDone.size,
        top: topWeight ? `${topName} ${topWeight}` : null,
      };
    })
    .filter((d) => d.exercisesDone > 0)
    .slice(0, 30);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Progress</h1>

      <section className="rounded-xl border border-border p-4">
        <h2 className="text-sm font-medium">Bodyweight</h2>
        <form action={logBodyweight} className="mt-3 flex flex-wrap gap-2">
          <input
            type="date"
            name="date"
            defaultValue={today()}
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
        {history.length === 0 ? (
          <p className="text-sm text-text-muted">
            Completed days show up here once you&apos;ve logged sets on them.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/day/${d.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 hover:bg-surface"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {formatLong(d.date)}
                      {d.category && (
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-xs ${CATEGORY_STYLE[d.category]}`}
                        >
                          {CATEGORY_LABEL[d.category]}
                        </span>
                      )}
                      {d.partyName && (
                        <span className="text-xs text-text-muted">· {d.partyName}</span>
                      )}
                    </span>
                    <span className="text-xs text-text-muted">
                      vol <span className="text-text">{d.volume}</span>
                    </span>
                  </div>
                  <div className="text-xs text-text-muted">
                    {d.exercisesDone} exercise{d.exercisesDone === 1 ? "" : "s"}
                    {d.top && <> · top {d.top}</>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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
