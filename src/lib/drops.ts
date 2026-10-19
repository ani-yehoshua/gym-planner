// Drop sets: after a set's top weight, the lifter strips weight and keeps going.
// A logged set stores its drops as [{ weight, reps }, ...] in order.

export type Drop = { weight: number | null; reps: number | null };

/** The drops out of a jsonb column, tolerant of anything odd in it. */
export function parseDrops(raw: unknown): Drop[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(d => {
        const o = (d ?? {}) as { weight?: unknown; reps?: unknown };
        return {
            weight: typeof o.weight === 'number' ? o.weight : null,
            reps: typeof o.reps === 'number' ? o.reps : null,
        };
    });
}

/** Drops with something in them, as they're stored (empty rows are dropped). */
export function cleanDrops(drops: Drop[]): Drop[] {
    return drops.filter(d => d.weight !== null || d.reps !== null);
}

/** Weight × reps summed over the drops. */
export function dropVolume(drops: Drop[]): number {
    return drops.reduce((sum, d) => sum + (d.weight ?? 0) * (d.reps ?? 0), 0);
}
