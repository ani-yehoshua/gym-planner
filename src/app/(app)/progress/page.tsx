import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logBodyweight } from "@/app/actions";
import { isoDateInTz, startOfWeek } from "@/lib/date";
import { getUserToday, getUserTimezone } from "@/lib/user-today";
import { HistoryList, type HistoryDay } from "@/components/history-list";
import {
    StrengthWidgets,
    type StrengthRow,
} from "@/components/strength-widgets";
import { unitLabel, type Unit } from "@/lib/units";

export default async function ProgressPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const [todayISO, tz] = await Promise.all([
        getUserToday(),
        getUserTimezone(),
    ]);

    const [
        { data: bw },
        { data: sets },
        { data: pastDays },
        { data: profile },
    ] = await Promise.all([
        supabase
            .from("bodyweight_logs")
            .select("date, weight")
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .limit(500),
        supabase
            .from("set_logs")
            .select(
                "weight, reps, logged_at, planned_day_exercises(exercises(id, name, category, time_based))",
            )
            .eq("user_id", user.id)
            .not("weight", "is", null)
            .not("reps", "is", null)
            .order("logged_at", { ascending: false })
            .limit(2000),
        // ---- history: past days where you logged something --------------------
        supabase
            .from("planned_days")
            .select(
                "id, date, category, party_id, is_deload, parties(name), planned_day_exercises(id, sort, exercises(name, primary_muscles, time_based, measurement))",
            )
            .lte("date", todayISO)
            .order("date", { ascending: false })
            .limit(60),
        supabase
            .from("profiles")
            .select("units")
            .eq("id", user.id)
            .maybeSingle(),
    ]);

    const units: Unit = (profile?.units as Unit) ?? "lb";
    const u = unitLabel(units);

    // weighted sets for the Lifts widgets — dates resolved in the user's zone
    const strengthRows: StrengthRow[] = (sets ?? []).flatMap(s => {
        const ex = s.planned_day_exercises?.exercises;
        if (!ex || ex.time_based || s.weight == null || s.reps == null)
            return [];
        return [
            {
                exerciseId: ex.id,
                name: ex.name,
                category: ex.category,
                weight: s.weight,
                reps: s.reps,
                date: isoDateInTz(new Date(s.logged_at), tz),
            },
        ];
    });

    const bwMax = Math.max(1, ...(bw ?? []).map(b => b.weight));
    const bwMin = Math.min(bwMax, ...(bw ?? []).map(b => b.weight));

    // Year > month > week grouping, same collapse shape as HistoryList, so
    // long bodyweight history doesn't just dump a giant flat list.
    const BW_MONTHS = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    type BwEntry = { date: string; weight: number };
    const bwWeeks: { start: string; entries: BwEntry[] }[] = [];
    for (const b of bw ?? []) {
        const ws = startOfWeek(b.date);
        const bucket = bwWeeks.find(w => w.start === ws);
        if (bucket) bucket.entries.push(b);
        else bwWeeks.push({ start: ws, entries: [b] });
    }
    const bwGroups: {
        year: string;
        months: { key: string; label: string; weeks: typeof bwWeeks }[];
    }[] = [];
    for (const w of bwWeeks) {
        const year = w.start.slice(0, 4);
        const key = w.start.slice(0, 7);
        let y = bwGroups.find(g => g.year === year);
        if (!y) bwGroups.push((y = { year, months: [] }));
        let m = y.months.find(x => x.key === key);
        if (!m)
            y.months.push(
                (m = {
                    key,
                    label: BW_MONTHS[Number(key.slice(5)) - 1],
                    weeks: [],
                }),
            );
        m.weeks.push(w);
    }

    const pastPdeIds = (pastDays ?? []).flatMap(d =>
        d.planned_day_exercises.map(p => p.id),
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
        .map(d => {
            // rep-based and timed volume are kept apart: timed sets store seconds
            // in `reps`, so weight × seconds would swamp weight × reps in one total
            let volume = 0;
            let timedVolume = 0;
            let topWeight = 0;
            let topName = "";
            const exercises: HistoryDay["exercises"] = [];

            for (const pde of [...d.planned_day_exercises].sort(
                (a, b) => a.sort - b.sort,
            )) {
                const done = (logsByPde.get(pde.id) ?? []).filter(
                    l => l.weight != null && l.reps != null,
                );
                if (done.length === 0) continue;
                let exVol = 0;
                let exTop = 0;
                for (const l of done) {
                    exVol += l.weight! * l.reps!;
                    if (l.weight! > exTop) exTop = l.weight!;
                }
                // rows here always have reps, so a time / time-or-distance exercise
                // can only be a timed set
                const timed =
                    !!pde.exercises?.time_based ||
                    pde.exercises?.measurement === "time" ||
                    pde.exercises?.measurement === "time_or_distance";
                if (timed) timedVolume += exVol;
                else volume += exVol;
                if (exTop > topWeight) {
                    topWeight = exTop;
                    topName = pde.exercises?.name ?? "";
                }
                exercises.push({
                    name: pde.exercises?.name ?? "?",
                    muscles: pde.exercises?.primary_muscles ?? [],
                    sets: done.map(l => ({ weight: l.weight!, reps: l.reps! })),
                    volume: exVol,
                    timed,
                    top: exTop,
                });
            }

            return {
                id: d.id,
                date: d.date,
                category: d.category,
                partyName: d.party_id ? (d.parties?.name ?? "Party") : null,
                isDeload: d.is_deload,
                volume,
                timedVolume,
                exercisesDone: exercises.length,
                top: topWeight ? `${topName} ${topWeight}` : null,
                exercises,
            };
        })
        .filter(d => d.exercisesDone > 0)
        .slice(0, 60);

    // group history into Sun–Sat weeks: weeks newest-first, days within a week
    // in chronological (ascending) order
    const weeks: { start: string; days: HistoryDay[] }[] = [];
    for (const d of history) {
        const ws = startOfWeek(d.date);
        const bucket = weeks.find(w => w.start === ws);
        if (bucket) bucket.days.push(d);
        else weeks.push({ start: ws, days: [d] });
    }
    for (const w of weeks) w.days.sort((a, b) => a.date.localeCompare(b.date));

    return (
        <div className='flex flex-col gap-6'>
            <h1 className='text-lg font-semibold'>Progress</h1>

            <section className='rounded-xl border border-border p-4'>
                <h2 className='text-sm font-medium'>Bodyweight ({u})</h2>
                <form
                    action={logBodyweight}
                    className='mt-3 flex flex-wrap gap-2'>
                    <input
                        type='date'
                        name='date'
                        defaultValue={todayISO}
                        className='rounded-lg border border-border bg-surface px-3 py-2 text-sm'
                    />
                    <input
                        type='number'
                        step='0.1'
                        name='weight'
                        required
                        placeholder={`Weight (${u})`}
                        className='w-32 rounded-lg border border-border bg-surface px-3 py-2 text-sm'
                    />
                    <button className='rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg'>
                        Log
                    </button>
                </form>

                {(bw ?? []).length > 0 && (
                    <>
                        <p className='mt-4 text-xs text-text-muted'>
                            Latest{" "}
                            <span className='font-medium text-text'>
                                {bw![0].weight} {u}
                            </span>{" "}
                            · {bw![0].date.slice(5)}
                        </p>

                        <div className='mt-2 max-h-96 overflow-y-auto overflow-x-hidden rounded-xl border border-border'>
                            {bwGroups.map((y, yi) => (
                                <details
                                    key={y.year}
                                    open={yi === 0}
                                    className={
                                        yi > 0 ? "border-t border-border" : ""
                                    }>
                                    <summary className='flex cursor-pointer list-none items-center justify-between bg-surface/60 px-3 py-2 text-sm font-semibold'>
                                        {y.year}
                                        <span className='text-xs font-normal text-text-muted'>
                                            {y.months.reduce(
                                                (n, m) =>
                                                    n +
                                                    m.weeks.reduce(
                                                        (k, w) =>
                                                            k +
                                                            w.entries.length,
                                                        0,
                                                    ),
                                                0,
                                            )}{" "}
                                            logs ▾
                                        </span>
                                    </summary>
                                    {y.months.map((m, mi) => (
                                        <details
                                            key={m.key}
                                            open={yi === 0 && mi === 0}
                                            className='border-t border-border'>
                                            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium'>
                                                {m.label}
                                                <span className='text-xs font-normal text-text-muted'>
                                                    {m.weeks.reduce(
                                                        (k, w) =>
                                                            k +
                                                            w.entries.length,
                                                        0,
                                                    )}{" "}
                                                    logs ▾
                                                </span>
                                            </summary>
                                            <div className='border-t border-border pl-2'>
                                                {m.weeks.map((w, wi) => (
                                                    <details
                                                        key={w.start}
                                                        open={
                                                            yi === 0 &&
                                                            mi === 0 &&
                                                            wi === 0
                                                        }
                                                        className={
                                                            wi > 0
                                                                ? "border-t border-border"
                                                                : ""
                                                        }>
                                                        <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm'>
                                                            <span className='font-medium'>
                                                                Week of{" "}
                                                                {w.start.slice(
                                                                    5,
                                                                )}
                                                            </span>
                                                            <span className='text-xs text-text-muted'>
                                                                {
                                                                    w.entries
                                                                        .length
                                                                }{" "}
                                                                {w.entries
                                                                    .length ===
                                                                1
                                                                    ? "log"
                                                                    : "logs"}{" "}
                                                                ▾
                                                            </span>
                                                        </summary>
                                                        <ul className='flex flex-col gap-1 border-t border-border p-2'>
                                                            {w.entries.map(
                                                                b => (
                                                                    <li
                                                                        key={
                                                                            b.date
                                                                        }
                                                                        className='flex items-center gap-3 text-xs'>
                                                                        <span className='w-20 text-text-muted'>
                                                                            {b.date.slice(
                                                                                5,
                                                                            )}
                                                                        </span>
                                                                        <span className='flex-1'>
                                                                            <span
                                                                                className='inline-block h-2 rounded bg-emerald-500/60'
                                                                                style={{
                                                                                    width: `${
                                                                                        bwMax ===
                                                                                        bwMin
                                                                                            ? 100
                                                                                            : 20 +
                                                                                              (70 *
                                                                                                  (b.weight -
                                                                                                      bwMin)) /
                                                                                                  (bwMax -
                                                                                                      bwMin)
                                                                                    }%`,
                                                                                }}
                                                                            />
                                                                        </span>
                                                                        <span className='w-12 text-right text-text-muted'>
                                                                            {
                                                                                b.weight
                                                                            }
                                                                        </span>
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    </details>
                                                ))}
                                            </div>
                                        </details>
                                    ))}
                                </details>
                            ))}
                        </div>
                    </>
                )}
            </section>

            <section>
                <h2 className='mb-2 text-sm font-medium'>History</h2>
                <p className='mb-2 text-xs text-text-muted'>
                    Tick 2–4 days to compare them.
                </p>
                {weeks.length === 0 ? (
                    <p className='text-sm text-text-muted'>
                        Completed days show up here once you&apos;ve logged sets
                        on them.
                    </p>
                ) : (
                    <HistoryList weeks={weeks} />
                )}
            </section>

            <StrengthWidgets
                rows={strengthRows}
                todayISO={todayISO}
                units={units}
            />
        </div>
    );
}
