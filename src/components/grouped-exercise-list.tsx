import { Fragment, type ReactNode } from "react";
import { groupVariants, type VariantItem } from "@/lib/variants";

/** The <li>s for a list of exercises, with grip variants of one lift gathered
 *  into a single expandable entry ("Lat Pulldown · 4 grips") instead of several
 *  near-identical rows. `renderItem` draws one exercise as an <li>; `label` is
 *  the grip name when it's shown inside its group, else null. Works in both
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
                                    {entry.items.length} grips ▾
                                </span>
                            </summary>
                            <ul className='flex flex-col gap-1 border-t border-border p-1'>
                                {entry.items.map(it => (
                                    <Fragment key={it.id}>
                                        {renderItem(it, it.variant_label)}
                                    </Fragment>
                                ))}
                            </ul>
                        </details>
                    </li>
                ),
            )}
        </>
    );
}
