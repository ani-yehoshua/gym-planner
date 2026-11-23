import type { Unit } from '@/lib/units';

/** The tape-measure sites, in the order they're shown. `id` is the column. */
export const SITES = [
    { id: 'waist', label: 'Waist' },
    { id: 'neck', label: 'Neck' },
    { id: 'upper_arm', label: 'Upper arms' },
    { id: 'forearm', label: 'Forearms' },
    { id: 'chest', label: 'Chest' },
    { id: 'thigh', label: 'Thighs' },
    { id: 'calf', label: 'Calves' },
] as const;

export type SiteId = (typeof SITES)[number]['id'];

/** One logged day: any site may be missing. */
export type MeasurementRow = { date: string } & Record<SiteId, number | null>;

const CM_PER_INCH = 2.54;

/** Pounds users measure in inches, kilogram users in centimetres. */
export const lengthUnit = (units: Unit) => (units === 'lb' ? 'in' : 'cm');

/** What was typed, in the member's unit, as centimetres for storage. */
export const toCm = (value: number, units: Unit) =>
    units === 'lb' ? value * CM_PER_INCH : value;

/** Stored centimetres, in the member's unit, to one decimal place. */
export const fromCm = (cm: number, units: Unit) =>
    Math.round((units === 'lb' ? cm / CM_PER_INCH : cm) * 10) / 10;
