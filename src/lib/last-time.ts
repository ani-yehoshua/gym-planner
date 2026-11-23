import type { createClient } from '@/lib/supabase/server';
import { parseDrops, type Drop } from '@/lib/drops';

type Client = Awaited<ReturnType<typeof createClient>>;

/** What an exercise looked like the last time you did it before a given day. */
export type LastEntry = {
    date: string;
    sets: {
        weight: number;
        reps: number;
        distance: number | null;
        drops: Drop[];
    }[];
    /** total volume of that session (weight × reps, drops included) */
    volume: number;
    note?: string;
};

const PAGE = 1000;

/** Every row of a query, a page at a time (the API caps a response at 1000). */
async function allRows<T>(
    page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data } = await page(from, from + PAGE - 1);
        out.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
    }
    return out;
}

/** For each exercise, the most recent session of yours strictly before
 *  `beforeDate`: its sets, volume and note. Exercises you hadn't done before
 *  are left out. */
export async function computeLastTimes(
    supabase: Client,
    userId: string,
    exerciseIds: string[],
    beforeDate: string,
): Promise<Record<string, LastEntry>> {
    if (exerciseIds.length === 0) return {};

    const [logs, notes] = await Promise.all([
        allRows((from, to) =>
            supabase
                .from('set_logs')
                .select(
                    'set_no, weight, reps, distance, volume, drops, planned_day_exercises!inner(exercise_id, planned_days!inner(date))',
                )
                .eq('user_id', userId)
                .in('planned_day_exercises.exercise_id', exerciseIds)
                .lt('planned_day_exercises.planned_days.date', beforeDate)
                .order('id')
                .range(from, to),
        ),
        allRows((from, to) =>
            supabase
                .from('day_exercise_notes')
                .select(
                    'note, planned_day_exercise_id, planned_day_exercises!inner(exercise_id, planned_days!inner(date))',
                )
                .eq('user_id', userId)
                .in('planned_day_exercises.exercise_id', exerciseIds)
                .lt('planned_day_exercises.planned_days.date', beforeDate)
                .order('planned_day_exercise_id')
                .range(from, to),
        ),
    ]);

    type Row = {
        date: string;
        set_no: number;
        weight: number;
        reps: number;
        distance: number | null;
        drops: Drop[];
        volume: number;
    };
    const rowsByEx: Record<string, Row[]> = {};
    for (const r of logs) {
        const pde = r.planned_day_exercises;
        const date = pde?.planned_days?.date;
        if (!pde || !date) continue;
        if (r.weight == null && r.reps == null && r.distance == null) continue;
        (rowsByEx[pde.exercise_id] ??= []).push({
            date,
            set_no: r.set_no,
            weight: r.weight ?? 0,
            reps: r.reps ?? 0,
            distance: r.distance,
            drops: parseDrops(r.drops),
            volume: r.volume ?? 0,
        });
    }

    const out: Record<string, LastEntry> = {};
    for (const [exId, rows] of Object.entries(rowsByEx)) {
        const maxDate = rows.reduce((a, r) => (r.date > a ? r.date : a), '');
        const latest = rows
            .filter(r => r.date === maxDate)
            .sort((a, b) => a.set_no - b.set_no);
        out[exId] = {
            date: maxDate,
            sets: latest.map(r => ({
                weight: r.weight,
                reps: r.reps,
                distance: r.distance,
                drops: r.drops,
            })),
            volume: latest.reduce((sum, r) => sum + r.volume, 0),
        };
    }
    for (const n of notes) {
        const pde = n.planned_day_exercises;
        const date = pde?.planned_days?.date;
        const entry = pde ? out[pde.exercise_id] : undefined;
        if (!pde || !entry || date !== entry.date) continue;
        const note = (n.note ?? '').trim();
        if (note) entry.note = note;
    }
    return out;
}

/** Stamp the "Last" row onto an exercise of a day, once: worked out from your
 *  history as it stands now and kept with that day from then on. Does nothing
 *  if it's already stamped. */
export async function stampLastTime(
    supabase: Client,
    userId: string,
    pdeId: string,
) {
    const { data: stamped } = await supabase
        .from('day_exercise_last')
        .select('planned_day_exercise_id')
        .eq('planned_day_exercise_id', pdeId)
        .eq('user_id', userId)
        .maybeSingle();
    if (stamped) return;

    const { data: pde } = await supabase
        .from('planned_day_exercises')
        .select('exercise_id, planned_days(date)')
        .eq('id', pdeId)
        .maybeSingle();
    const date = pde?.planned_days?.date;
    if (!pde || !date) return;

    const found = (
        await computeLastTimes(supabase, userId, [pde.exercise_id], date)
    )[pde.exercise_id];
    await supabase.from('day_exercise_last').upsert(
        {
            planned_day_exercise_id: pdeId,
            user_id: userId,
            entry: found ?? null,
        },
        {
            onConflict: 'planned_day_exercise_id,user_id',
            ignoreDuplicates: true,
        },
    );
}
