import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

export type ProgramExerciseProgress = {
    exerciseId: string;
    name: string;
    timed: boolean;
    sets: number;
    sessions: number;
    volume: number;
    bestWeight: number;
    /** heaviest weight in the first and the latest session of this program */
    firstTop: number;
    lastTop: number;
};

export type ProgramProgress = {
    /** training days of the program that are on the calendar */
    plannedDays: number;
    /** those days themselves, with where each falls in the program */
    days: {
        id: string;
        date: string;
        label: string | null;
        number: number | null;
        done: boolean;
    }[];
    /** of those, days where the member logged something */
    doneDays: number;
    sets: number;
    /** weight × reps over rep-based exercises (timed sets are left out) */
    volume: number;
    exercises: ProgramExerciseProgress[];
};

/** How far along a member is in a program, from their own logged sets on the
 *  program's calendar days. With a range it covers just that run; without one,
 *  every run of the program that's still on the calendar. */
export async function fetchProgramProgress(
    supabase: Client,
    userId: string,
    programId: string,
    range?: { start: string; end: string },
): Promise<ProgramProgress> {
    let daysQuery = supabase
        .from('planned_days')
        .select('id, date, label, program_day_number')
        .eq('program_id', programId);
    let logsQuery = supabase
        .from('set_logs')
        .select(
            'weight, reps, volume, planned_day_exercises!inner(exercise_id, exercises(name, time_based, measurement), planned_days!inner(id, date, program_id))',
        )
        .eq('user_id', userId)
        .eq('planned_day_exercises.planned_days.program_id', programId);
    if (range) {
        daysQuery = daysQuery.gte('date', range.start).lte('date', range.end);
        logsQuery = logsQuery
            .gte('planned_day_exercises.planned_days.date', range.start)
            .lte('planned_day_exercises.planned_days.date', range.end);
    }
    const [{ data: days }, { data: logs }] = await Promise.all([
        daysQuery,
        logsQuery,
    ]);

    type Agg = ProgramExerciseProgress & {
        byDate: Map<string, number>; // date -> heaviest weight that day
        dayIds: Set<string>;
    };
    const byExercise = new Map<string, Agg>();
    const doneDays = new Set<string>();
    let sets = 0;
    let volume = 0;

    for (const l of logs ?? []) {
        const pde = l.planned_day_exercises;
        const day = pde?.planned_days;
        if (!pde || !day || (l.weight == null && l.reps == null)) continue;
        const timed =
            !!pde.exercises?.time_based ||
            pde.exercises?.measurement === 'time' ||
            pde.exercises?.measurement === 'time_or_distance';
        const weight = l.weight ?? 0;

        doneDays.add(day.id);
        sets++;
        const agg =
            byExercise.get(pde.exercise_id) ??
            ({
                exerciseId: pde.exercise_id,
                name: pde.exercises?.name ?? '?',
                timed,
                sets: 0,
                sessions: 0,
                volume: 0,
                bestWeight: 0,
                firstTop: 0,
                lastTop: 0,
                byDate: new Map<string, number>(),
                dayIds: new Set<string>(),
            } satisfies Agg);
        agg.sets++;
        agg.dayIds.add(day.id);
        if (!timed) {
            const v = l.volume ?? weight * (l.reps ?? 0);
            agg.volume += v;
            volume += v;
        }
        if (weight > agg.bestWeight) agg.bestWeight = weight;
        agg.byDate.set(
            day.date,
            Math.max(agg.byDate.get(day.date) ?? 0, weight),
        );
        byExercise.set(pde.exercise_id, agg);
    }

    const exercises = [...byExercise.values()]
        .map(a => {
            const dates = [...a.byDate.keys()].sort();
            return {
                exerciseId: a.exerciseId,
                name: a.name,
                timed: a.timed,
                sets: a.sets,
                sessions: a.dayIds.size,
                volume: Math.round(a.volume),
                bestWeight: a.bestWeight,
                firstTop: a.byDate.get(dates[0]) ?? 0,
                lastTop: a.byDate.get(dates[dates.length - 1]) ?? 0,
            };
        })
        .sort((a, b) => b.volume - a.volume || a.name.localeCompare(b.name));

    return {
        plannedDays: (days ?? []).length,
        days: (days ?? [])
            .map(d => ({
                id: d.id,
                date: d.date,
                label: d.label,
                number: d.program_day_number,
                done: doneDays.has(d.id),
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        doneDays: doneDays.size,
        sets,
        volume: Math.round(volume),
        exercises,
    };
}
