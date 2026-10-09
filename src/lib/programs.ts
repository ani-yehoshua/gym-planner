import { addDays } from './date';
import { formatDuration } from './duration';

export type DurationUnit = 'days' | 'weeks';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export const DIFFICULTIES: readonly Difficulty[] = [
    'beginner',
    'intermediate',
    'advanced',
];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
};
// tinted pills in the same style as the session-type chips
export const DIFFICULTY_STYLE: Record<Difficulty, string> = {
    beginner:
        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    intermediate:
        'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    advanced:
        'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

/** A difficulty out of a database / form value, or null if it isn't one. */
export function parseDifficulty(value: unknown): Difficulty | null {
    return DIFFICULTIES.includes(value as Difficulty)
        ? (value as Difficulty)
        : null;
}

/** The rep range for one set. */
export type SetRep = { min: number | null; max: number | null };

/** What an admin submits when creating or saving a program: an ordered list of
 *  days (training days with exercises, or rest days) and a duration. Each
 *  exercise has a set count and a rep range per set. */
export type ProgramInput = {
    id?: string;
    name: string;
    description: string;
    durationUnit: DurationUnit;
    durationCount: number;
    difficulty: Difficulty | null;
    days: {
        name: string;
        isRest: boolean;
        exercises: {
            exerciseId: string;
            sets: number | null;
            setReps: SetRep[];
            /** exercises sharing a number (and next to each other) are a superset */
            supersetGroup: number | null;
        }[];
    }[];
};

/** The per-set ranges out of a jsonb column, tolerant of anything odd in it. */
export function parseSetReps(raw: unknown): SetRep[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(r => {
        const o = (r ?? {}) as { min?: unknown; max?: unknown };
        return {
            min: typeof o.min === 'number' ? o.min : null,
            max: typeof o.max === 'number' ? o.max : null,
        };
    });
}

/** The range for set `i` (0-based): its own entry, else the last one repeats. */
export function repsForSet(list: SetRep[], i: number): SetRep {
    return list[i] ?? list[list.length - 1] ?? { min: null, max: null };
}

/** One range covering every set: the lowest min and the highest max. */
export function summarizeSetReps(list: SetRep[]): SetRep {
    const mins = list.flatMap(r => (r.min != null ? [r.min] : []));
    const maxs = list.flatMap(r => (r.max != null ? [r.max] : []));
    return {
        min: mins.length ? Math.min(...mins) : null,
        max: maxs.length ? Math.max(...maxs) : null,
    };
}

/** "12–15 · 10–12 · 8–10", or a single range when every set is the same. */
export function formatSetReps(
    list: SetRep[],
    sets: number,
    fmt: (n: number) => string = String,
): string {
    const per = Array.from({ length: Math.max(sets, 1) }, (_, i) => {
        const r = repsForSet(list, i);
        return formatRepRange(r.min, r.max, fmt);
    });
    return per.every(x => x === per[0]) ? per[0] : per.join(' · ');
}

export function clampDuration(unit: DurationUnit, count: number): number {
    const max = unit === 'weeks' ? 52 : 365;
    return Math.min(Math.max(Math.round(count) || 1, 1), max);
}

/** How many calendar days a program runs for. */
export function programTotalDays(unit: DurationUnit, count: number): number {
    return unit === 'weeks' ? count * 7 : count;
}

/** The last date of a program started on `start`. */
export function programEndDate(
    start: string,
    unit: DurationUnit,
    count: number,
): string {
    return addDays(start, programTotalDays(unit, count) - 1);
}

export function durationLabel(unit: string, count: number): string {
    const word = unit === 'weeks' ? 'week' : 'day';
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** The Calendar's "Plan session…" lists programs next to the plain session
 *  types; this prefix on the option value tells them apart. */
export const PROGRAM_PREFIX = 'program:';

export function programChoiceValue(programId: string): string {
    return `${PROGRAM_PREFIX}${programId}`;
}

export function parseProgramChoice(value: string): string | null {
    return value.startsWith(PROGRAM_PREFIX)
        ? value.slice(PROGRAM_PREFIX.length) || null
        : null;
}

/** How a program exercise reads: "3 × 8–12" when every set is the same,
 *  "3 sets · 12–15 · 10–12 · 8–10" when each set has its own range. */
export function describeSets(
    sets: number | null,
    setReps: SetRep[],
    fallbackMin: number | null,
    fallbackMax: number | null,
    /** a timed exercise: ranges are times (0:30–1:00), not rep counts */
    timed = false,
): string {
    if (setReps.length === 0)
        return formatRx(sets, fallbackMin, fallbackMax, timed);
    const n = sets ?? setReps.length;
    const reps = formatSetReps(setReps, n, timed ? formatDuration : String);
    if (!reps) return `${n} ${n === 1 ? 'set' : 'sets'}`;
    return reps.includes(' · ') ? `${n} sets · ${reps}` : `${n} × ${reps}`;
}

/** "3 × 8–12", "3 sets", "8–12 reps", or "" when nothing's specified. */
export function formatRx(
    sets: number | null,
    repMin: number | null,
    repMax: number | null,
    timed = false,
): string {
    const reps = formatRepRange(
        repMin,
        repMax,
        timed ? formatDuration : String,
    );
    if (sets != null && reps) return `${sets} × ${reps}`;
    if (sets != null) return `${sets} sets`;
    if (!reps) return '';
    return timed ? reps : `${reps} reps`;
}

/** "8–12", "10", "8+", "up to 12", or "" — a rep range on its own. */
export function formatRepRange(
    repMin: number | null,
    repMax: number | null,
    /** how one number reads — String for reps, formatDuration for timed sets */
    fmt: (n: number) => string = String,
): string {
    if (repMin != null && repMax != null)
        return repMin === repMax
            ? fmt(repMin)
            : `${fmt(repMin)}–${fmt(repMax)}`;
    if (repMin != null) return `${fmt(repMin)}+`;
    if (repMax != null) return `up to ${fmt(repMax)}`;
    return '';
}
