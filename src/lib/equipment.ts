// What an exercise is done with, for the equipment filter. `none` stands for
// exercises with no equipment set (shown under "Other").

export const EQUIPMENT = [
    { id: 'barbell', label: 'Barbell' },
    { id: 'dumbbell', label: 'Dumbbell' },
    { id: 'cable', label: 'Cable' },
    { id: 'machine', label: 'Machine' },
    { id: 'bodyweight', label: 'Bodyweight' },
    { id: 'kettlebell', label: 'Kettlebell' },
    { id: 'band', label: 'Band' },
    { id: 'none', label: 'Other' },
] as const;

export type EquipmentId = (typeof EQUIPMENT)[number]['id'];

/** The value stored on an exercise (null = not set) as a filter id. */
export function equipmentId(value: string | null | undefined): EquipmentId {
    return EQUIPMENT.some(e => e.id === value) && value
        ? (value as EquipmentId)
        : 'none';
}

/** Whether an exercise passes the chosen equipment filters; none chosen = all. */
export function matchesEquipment(
    value: string | null | undefined,
    selected: readonly string[],
): boolean {
    return selected.length === 0 || selected.includes(equipmentId(value));
}
