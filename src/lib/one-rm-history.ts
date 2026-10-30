import type { createClient } from '@/lib/supabase/server';

/** An actual max attempt: your heaviest single on one exercise in one session. */
export type OneRmEntry = {
    exerciseId: string;
    name: string;
    weight: number;
    date: string; // YYYY-MM-DD, the session's date
};

type Client = Awaited<ReturnType<typeof createClient>>;

/** A note that calls the exercise a max attempt ("1RM", "1 rm", "one rep max"). */
const ONE_RM_NOTE = /\b1\s*-?\s*rm\b|\bone[\s-]*rep[\s-]*max\b/i;

/** Every 1RM the member has actually tested, newest first: for each exercise
 *  and session, the heaviest set of exactly one rep. Estimates don't count.
 *  There's no "1RM attempt" switch on an exercise, so a session counts as a
 *  test when any of these holds:
 *    - it's a 1RM day,
 *    - the member ticked "1RM attempt" on the exercise, or their note on it
 *      says 1RM,
 *    - they worked up through two or more singles and the heaviest weight of
 *      the session is one of them (a ramp to a max, not a single in a rep
 *      block). */
export async function fetchOneRmHistory(
    supabase: Client,
    userId: string,
): Promise<OneRmEntry[]> {
    const [{ data: singles }, { data: noted }, { data: marked }] =
        await Promise.all([
            supabase
                .from('set_logs')
                .select(
                    'weight, planned_day_exercise_id, planned_day_exercises!inner(exercise_id, exercises(name), planned_days!inner(date, category))',
                )
                .eq('user_id', userId)
                .eq('reps', 1)
                .not('weight', 'is', null),
            supabase
                .from('day_exercise_notes')
                .select('planned_day_exercise_id, note')
                .eq('user_id', userId)
                .or(
                    'note.ilike.%1rm%,note.ilike.%1 rm%,note.ilike.%1-rm%,note.ilike.%one rep max%',
                ),
            supabase
                .from('day_exercise_user_targets')
                .select('planned_day_exercise_id')
                .eq('user_id', userId)
                .eq('is_one_rm', true),
        ]);

    // exercises the member called a 1RM attempt: ticked, or said so in a note
    const notedIds = new Set([
        ...(marked ?? []).map(m => m.planned_day_exercise_id),
        ...(noted ?? [])
            .filter(n => ONE_RM_NOTE.test(n.note ?? ''))
            .map(n => n.planned_day_exercise_id),
    ]);

    // singles grouped by exercise-in-a-session
    type Group = {
        exerciseId: string;
        name: string;
        date: string;
        isOneRmDay: boolean;
        weights: number[];
    };
    const groups = new Map<string, Group>();
    for (const row of singles ?? []) {
        const pde = row.planned_day_exercises;
        const day = pde?.planned_days;
        if (!pde || !day || row.weight == null || row.weight <= 0) continue;
        const g = groups.get(row.planned_day_exercise_id) ?? {
            exerciseId: pde.exercise_id,
            name: pde.exercises?.name ?? '?',
            date: day.date,
            isOneRmDay: day.category === 'one_rm',
            weights: [],
        };
        g.weights.push(row.weight);
        groups.set(row.planned_day_exercise_id, g);
    }

    // a ramp of singles only counts if nothing heavier was lifted for reps
    const rampIds = [...groups.entries()]
        .filter(
            ([id, g]) =>
                !g.isOneRmDay && !notedIds.has(id) && g.weights.length >= 2,
        )
        .map(([id]) => id);
    const heaviestAny = new Map<string, number>();
    for (let i = 0; i < rampIds.length; i += 100) {
        const { data } = await supabase
            .from('set_logs')
            .select('planned_day_exercise_id, weight')
            .eq('user_id', userId)
            .in('planned_day_exercise_id', rampIds.slice(i, i + 100))
            .not('weight', 'is', null);
        for (const s of data ?? []) {
            heaviestAny.set(
                s.planned_day_exercise_id,
                Math.max(
                    heaviestAny.get(s.planned_day_exercise_id) ?? 0,
                    s.weight ?? 0,
                ),
            );
        }
    }

    const best = new Map<string, OneRmEntry>();
    for (const [id, g] of groups) {
        const top = Math.max(...g.weights);
        const isRamp = g.weights.length >= 2 && heaviestAny.get(id) === top;
        if (!g.isOneRmDay && !notedIds.has(id) && !isRamp) continue;
        const key = `${g.exerciseId}:${g.date}`;
        const prev = best.get(key);
        if (!prev || top > prev.weight) {
            best.set(key, {
                exerciseId: g.exerciseId,
                name: g.name,
                weight: top,
                date: g.date,
            });
        }
    }
    return [...best.values()].sort((a, b) => b.date.localeCompare(a.date));
}
