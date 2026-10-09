import { formatDuration } from './duration';

/** One logged set as text. A set with no weight (bodyweight work — a hanging
 *  leg raise, a push-up) reads "10 reps" instead of "0×10"; a timed set shows
 *  its time ("1:30", or "25×1:30" when it's weighted). */
export function formatSet(
    weight: number | null | undefined,
    reps: number,
    timed = false,
): string {
    const w = weight && weight > 0 ? weight : 0;
    if (timed) return w ? `${w}×${formatDuration(reps)}` : formatDuration(reps);
    return w ? `${w}×${reps}` : `${reps} ${reps === 1 ? 'rep' : 'reps'}`;
}
