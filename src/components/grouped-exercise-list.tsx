import { Fragment, type ReactNode } from "react";
import { EQUIPMENT } from "@/lib/equipment";
import { GRIPS } from "@/lib/grips";
import { groupVariants, type VariantItem } from "@/lib/variants";

/** A group's members split into labelled sections. By grip (Underhand,
 *  Overhand, Neutral) when any member has one, members with no grip first and
 *  unlabelled. Otherwise by equipment (Cable › High-to-low, Low-to-high), but
 *  only when some equipment has several variations of its own; else one plain
 *  section. */
function gripSections<T extends VariantItem>(items: T[]) {
    if (!items.some(it => it.grip)) return equipmentSections(items);
    const sections = [
        { id: "none", label: null as string | null, items: [] as T[] },
        ...GRIPS.map(g => ({
            id: g.id as string,
            label: g.label as string | null,
            items: [] as T[],
        })),
    ];
    for (const it of items)
        (sections.find(s => s.id === it.grip) ?? sections[0]).items.push(it);
    return sections.filter(s => s.items.length > 0);
}

function equipmentSections<T extends VariantItem>(items: T[]) {
    const counts = new Map<string, number>();
    for (const it of items)
        if (it.equipment)
            counts.set(it.equipment, (counts.get(it.equipment) ?? 0) + 1);
    if (![...counts.values()].some(n => n >= 2))
        return [{ id: "all", label: null as string | null, items }];

    const sections = [
        { id: "none", label: null as string | null, items: [] as T[] },
        ...EQUIPMENT.filter(e => counts.has(e.id)).map(e => ({
            id: e.id as string,
            label: e.label as string | null,
            items: [] as T[],
        })),
    ];
    for (const it of items)
        (sections.find(s => s.id === it.equipment) ?? sections[0]).items.push(
            it,
        );
    return sections.filter(s => s.items.length > 0);
}

/** The <li>s for a list of exercises, with variations of one lift (grip,
 *  posture, equipment) gathered into a single expandable entry ("Lat Pulldown ·
 *  4 variations") instead of several near-identical rows. `renderItem` draws
 *  one exercise as an <li>; `label` is the variation name when it's shown
 *  inside its group, else null. Works in both
 *  server and client components. */
export function GroupedExerciseList<T extends VariantItem>({
    items,
    open,
    renderItem,
}: {
    items: T[];
    /** expand the grip groups (e.g. while searching) */
    open?: boolean;
    renderItem: (item: T, label: string | null) => ReactNode;
}) {
    return (
        <>
            {groupVariants(items).map(entry =>
                entry.kind === "single" ? (
                    <Fragment key={entry.item.id}>
                        {renderItem(entry.item, null)}
                    </Fragment>
                ) : (
                    <li
                        key={`variants-${entry.group}`}
                        data-variant-group>
                        <details
                            open={open}
                            className='rounded-lg border border-border'>
                            <summary className='flex cursor-pointer list-none items-center justify-between px-2 py-2 text-sm'>
                                <span>{entry.group}</span>
                                <span className='text-xs text-text-muted'>
                                    {entry.items.length} variations ▾
                                </span>
                            </summary>
                            <div className='flex flex-col gap-1 border-t border-border p-1'>
                                {gripSections(entry.items).map(sec => (
                                    <div
                                        key={sec.id}
                                        data-grip-section>
                                        {sec.label && (
                                            <div className='px-2 pt-1 text-xs font-medium text-text-muted'>
                                                {sec.label}
                                            </div>
                                        )}
                                        <ul className='flex flex-col gap-1'>
                                            {sec.items.map(it => (
                                                <Fragment key={it.id}>
                                                    {renderItem(
                                                        it,
                                                        it.variant_label,
                                                    )}
                                                </Fragment>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </details>
                    </li>
                ),
            )}
        </>
    );
}
