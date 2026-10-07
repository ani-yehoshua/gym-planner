import type { Enums } from './supabase/database.types';

export type Unit = Enums<'unit_system'>; // "lb" | "kg" -- weight only

/** Distance has its own unit, picked independently of the weight unit (lift in
 *  lb, carry in meters, walk in km). */
export type DistanceUnit = 'mi' | 'km' | 'm';
export const DISTANCE_UNITS: readonly DistanceUnit[] = ['mi', 'km', 'm'];

/** Weights are stored as raw numbers in whichever unit the user picked — the
 *  app never converts. This is just the label to show next to them. */
export function unitLabel(u: Unit | null | undefined): string {
    return u === 'kg' ? 'kg' : 'lb';
}

/** Same never-convert rule as weight: the label for the user's distance unit. */
export function distanceUnitLabel(d: string | null | undefined): DistanceUnit {
    return d === 'km' || d === 'm' ? d : 'mi';
}

export type Measurement = Enums<'exercise_measurement'>;
export type LogMode = 'time' | 'distance';
