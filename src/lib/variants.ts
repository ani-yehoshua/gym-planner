// Grip variants of one lift (Lat Pulldown: Wide / Close / Neutral…) are separate
// exercises, but read as a single entry in lists. `variant_group` is the shared
// name, `variant_label` the grip; both null for an ordinary exercise.

export type VariantItem = {
    id: string;
    variant_group: string | null;
    variant_label: string | null;
};

export type VariantEntry<T> =
    | { kind: 'single'; item: T }
    | { kind: 'variants'; group: string; items: T[] };

/** A list with each variant group collapsed into one entry, placed where its
 *  first member was. A group with only one member in the list (the rest filtered
 *  out or already added) is just shown as that exercise. */
export function groupVariants<T extends VariantItem>(
    items: T[],
): VariantEntry<T>[] {
    const members = new Map<string, T[]>();
    for (const item of items) {
        if (!item.variant_group) continue;
        members.set(item.variant_group, [
            ...(members.get(item.variant_group) ?? []),
            item,
        ]);
    }

    const out: VariantEntry<T>[] = [];
    const placed = new Set<string>();
    for (const item of items) {
        const g = item.variant_group;
        const group = g ? members.get(g) : undefined;
        if (!g || !group || group.length < 2) {
            out.push({ kind: 'single', item });
        } else if (!placed.has(g)) {
            placed.add(g);
            out.push({ kind: 'variants', group: g, items: group });
        }
    }
    return out;
}
