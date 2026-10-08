"use client";

import { useRef, useState } from "react";

/** Filters the server-rendered category groups/exercises passed as children,
 *  by toggling [hidden] on matches — same search-then-auto-expand feel as the
 *  add-exercise picker on a day, without needing the exercise data client-side. */
export function ExerciseSearch({ children }: { children: React.ReactNode }) {
    const [query, setQuery] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);

    function filter(q: string) {
        setQuery(q);
        const root = rootRef.current;
        if (!root) return;
        const needle = q.trim().toLowerCase();

        root.querySelectorAll<HTMLDetailsElement>(
            "[data-exercise-group]",
        ).forEach(group => {
            let anyVisible = false;
            group
                .querySelectorAll<HTMLElement>("[data-exercise-name]")
                .forEach(item => {
                    const match =
                        !needle ||
                        (item.dataset.exerciseName ?? "")
                            .toLowerCase()
                            .includes(needle);
                    item.hidden = !match;
                    if (match) anyVisible = true;
                });
            // a grip-variant entry (e.g. "Lat Pulldown") follows its grips:
            // hidden when none match, and opened while searching
            group
                .querySelectorAll<HTMLElement>("[data-variant-group]")
                .forEach(variants => {
                    const anyMatch = Array.from(
                        variants.querySelectorAll<HTMLElement>(
                            "[data-exercise-name]",
                        ),
                    ).some(item => !item.hidden);
                    variants.hidden = !anyMatch;
                    const details = variants.querySelector("details");
                    if (details) details.open = needle.length > 0;
                });
            group.hidden = !anyVisible;
            group.open = needle.length > 0;
        });
    }

    return (
        <div className='flex flex-col gap-3'>
            <input
                value={query}
                onChange={e => filter(e.target.value)}
                placeholder='Search exercises…'
                className='w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted'
            />
            <div
                ref={rootRef}
                className='flex flex-col gap-2'>
                {children}
            </div>
        </div>
    );
}
