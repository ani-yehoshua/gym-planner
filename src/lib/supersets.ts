// Supersets: exercises done back to back. Each exercise has a `group` number
// (null = not in one); exercises sharing a number and sitting next to each
// other in the list are a superset. These helpers keep that "next to each
// other" true as a day's exercise list is edited.

export type Grouped = { group: number | null };

type Block<T> = { group: number | null; items: { item: T; index: number }[] };

/** The list as consecutive blocks: each superset is one block, every other
 *  exercise its own. `index` is the position in the original list. */
export function toBlocks<T extends Grouped>(items: T[]): Block<T>[] {
    const blocks: Block<T>[] = [];
    items.forEach((item, index) => {
        const last = blocks[blocks.length - 1];
        if (item.group != null && last && last.group === item.group) {
            last.items.push({ item, index });
        } else {
            blocks.push({ group: item.group, items: [{ item, index }] });
        }
    });
    return blocks;
}

/** Where an exercise sits in its superset, for drawing one continuous outline
 *  across separate cards. null if it isn't in a superset. */
export function supersetPosition<T extends Grouped>(
    items: T[],
    i: number,
): 'first' | 'middle' | 'last' | null {
    const g = items[i].group;
    if (g == null) return null;
    const prev = i > 0 && items[i - 1].group === g;
    const next = i < items.length - 1 && items[i + 1].group === g;
    if (!prev && !next) return null; // a lone leftover isn't a superset
    if (!prev) return 'first';
    return next ? 'middle' : 'last';
}

/** Make every superset a single run of 2+ exercises: a group that ended up in
 *  separate places is split into its own groups, and one left with a single
 *  exercise is dropped. */
export function normalizeGroups<T extends Grouped>(items: T[]): T[] {
    let nextId = items.reduce((m, x) => Math.max(m, x.group ?? 0), 0) + 1;
    const seen = new Set<number>();
    const labels: (number | null)[] = items.map(x => x.group);

    let i = 0;
    while (i < items.length) {
        const g = items[i].group;
        if (g == null) {
            i++;
            continue;
        }
        let end = i;
        while (end + 1 < items.length && items[end + 1].group === g) end++;
        // a later, separate run that shares this number gets a number of its own
        const id = seen.has(g) ? nextId++ : g;
        seen.add(g);
        for (let k = i; k <= end; k++) labels[k] = id;
        i = end + 1;
    }

    const counts = new Map<number, number>();
    for (const id of labels)
        if (id != null) counts.set(id, (counts.get(id) ?? 0) + 1);

    return items.map((x, k) => {
        const id = labels[k];
        const final = id != null && (counts.get(id) ?? 0) >= 2 ? id : null;
        return final === x.group ? x : ({ ...x, group: final } as T);
    });
}

/** Bounds of the block (superset, or the lone exercise) containing index `i`. */
function blockBounds<T extends Grouped>(
    items: T[],
    i: number,
): [number, number] {
    const g = items[i].group;
    if (g == null) return [i, i];
    let start = i;
    let end = i;
    while (start > 0 && items[start - 1].group === g) start--;
    while (end < items.length - 1 && items[end + 1].group === g) end++;
    return [start, end];
}

/** ↑ / ↓ on one exercise. Inside a superset it swaps with its neighbour in the
 *  superset; at the edge of one (or when not in one) it moves the whole block
 *  past the next exercise or superset, so a superset is never split by a move. */
export function moveItem<T extends Grouped>(
    items: T[],
    i: number,
    dir: -1 | 1,
): T[] {
    const j = i + dir;
    if (j < 0 || j >= items.length) return items;
    if (items[i].group != null && items[j].group === items[i].group) {
        const copy = [...items];
        [copy[i], copy[j]] = [copy[j], copy[i]];
        return copy;
    }
    const [start, end] = blockBounds(items, i);
    const block = items.slice(start, end + 1);
    const rest = [...items.slice(0, start), ...items.slice(end + 1)];
    if (dir === -1) {
        if (start === 0) return items;
        const [nbStart] = blockBounds(items, start - 1);
        return [...rest.slice(0, nbStart), ...block, ...rest.slice(nbStart)];
    }
    if (end === items.length - 1) return items;
    const [, nbEnd] = blockBounds(items, end + 1);
    // `rest` no longer holds the block, so the neighbour's end shifts left by its length
    const at = nbEnd - block.length + 1;
    return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}

/** Put the exercises at `selected` (indices) into one new superset, gathered
 *  together at the place of the first one. */
export function makeSuperset<T extends Grouped>(
    items: T[],
    selected: Set<number>,
): T[] {
    const picked = items.filter((_, i) => selected.has(i));
    if (picked.length < 2) return items;
    const id = items.reduce((m, x) => Math.max(m, x.group ?? 0), 0) + 1;
    const first = items.findIndex((_, i) => selected.has(i));
    const before = items.filter((_, i) => i < first && !selected.has(i));
    const after = items.filter((_, i) => i > first && !selected.has(i));
    return normalizeGroups([
        ...before,
        ...picked.map(x => ({ ...x, group: id }) as T),
        ...after,
    ]);
}

/** Take the exercises at `selected` out of their supersets. */
export function ungroup<T extends Grouped>(
    items: T[],
    selected: Set<number>,
): T[] {
    return normalizeGroups(
        items.map((x, i) =>
            selected.has(i) ? ({ ...x, group: null } as T) : x,
        ),
    );
}
