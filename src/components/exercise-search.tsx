"use client";

import { useRef, useState } from "react";
import { EquipmentFilter } from "@/components/equipment-filter";
import { matchesEquipment } from "@/lib/equipment";

/** Filters the server-rendered category groups/exercises passed as children —
 *  by name and by equipment — by toggling [hidden] on matches. Same
 *  search-then-auto-expand feel as the add-exercise picker on a day, without
 *  needing the exercise data client-side. Each exercise row carries
 *  data-exercise-name and data-equipment for this. */
export function ExerciseSearch({ children }: { children: React.ReactNode }) {
    const [query, setQuery] = useState("");
    const [equipment, setEquipment] = useState<string[]>([]);
    const rootRef = useRef<HTMLDivElement>(null);

    function apply(q: string, equip: string[]) {
        const root = rootRef.current;
        if (!root) return;
        const needle = q.trim().toLowerCase();
        // open the groups up while any filter is narrowing the list
        const narrowing = needle.length > 0 || equip.length > 0;

        root.querySelectorAll<HTMLDetailsElement>(
            "[data-exercise-group]",
        ).forEach(group => {
            let anyVisible = false;
            group
                .querySelectorAll<HTMLElement>("[data-exercise-name]")
                .forEach(item => {
                    const match =
                        (!needle ||
                            (item.dataset.exerciseName ?? "")
                                .toLowerCase()
                                .includes(needle)) &&
                        matchesEquipment(item.dataset.equipment, equip);
                    item.hidden = !match;
                    if (match) anyVisible = true;
                });
            // a variations entry (e.g. "Lat Pulldown") follows its members:
            // hidden when none match, and opened while filtering
            group
                .querySelectorAll<HTMLElement>("[data-variant-group]")
                .forEach(variants => {
                    const anyMatch = Array.from(
                        variants.querySelectorAll<HTMLElement>(
                            "[data-exercise-name]",
                        ),
                    ).some(item => !item.hidden);
                    variants.hidden = !anyMatch;
                    // grip sub-sections (Underhand, Overhand…) follow their rows too
                    variants
                        .querySelectorAll<HTMLElement>("[data-grip-section]")
                        .forEach(sec => {
                            sec.hidden = !Array.from(
                                sec.querySelectorAll<HTMLElement>(
                                    "[data-exercise-name]",
                                ),
                            ).some(item => !item.hidden);
                        });
                    const details = variants.querySelector("details");
                    if (details) details.open = narrowing;
                });
            group.hidden = !anyVisible;
            group.open = narrowing;
        });
    }

    return (
        <div className='flex flex-col gap-3'>
            <input
                value={query}
                onChange={e => {
                    setQuery(e.target.value);
                    apply(e.target.value, equipment);
                }}
                placeholder='Search exercises…'
                className='w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted'
            />
            <EquipmentFilter
                selected={equipment}
                onChange={next => {
                    setEquipment(next);
                    apply(query, next);
                }}
            />
            <div
                ref={rootRef}
                className='flex flex-col gap-2'>
                {children}
            </div>
        </div>
    );
}
