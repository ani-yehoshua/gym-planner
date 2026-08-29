import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logBodyweight } from "@/app/actions";
import { today } from "@/lib/date";

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
