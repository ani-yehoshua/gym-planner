// Grip of an exercise, a second level under a variation group: "Biceps Curl"
// holds underhand, overhand (reverse) and neutral (hammer) curls, each in
// several pieces of equipment.

export const GRIPS = [
    { id: 'underhand', label: 'Underhand' },
    { id: 'overhand', label: 'Overhand (reverse)' },
    { id: 'neutral', label: 'Neutral (hammer)' },
] as const;

export const gripLabel = (id: string) =>
    GRIPS.find(g => g.id === id)?.label ?? id;
