"use client";

import { useState } from "react";
import type { ProgramExerciseProgress } from "@/lib/program-progress";

/** Per-exercise progress inside a program: a searchable, scrollable list. */
export function ProgramProgressList({
    exercises,
    unit,
}: {
    exercises: ProgramExerciseProgress[];
    unit: string;
}) {
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    const shown = needle
        ? exercises.filter(x => x.name.toLowerCase().includes(needle))
        : exercises;

    return (
        <div className='flex flex-col gap-1.5'>
            <input
                type='search'
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder='Search exercises…'
                aria-label='Search exercises in this program'
                className='w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-text-muted'
            />
            <ul className='flex max-h-72 flex-col divide-y divide-border overflow-y-auto text-sm'>
                {shown.map(x => {
                    const change = x.lastTop - x.firstTop;
                    return (
                        <li
                            key={x.exerciseId}
                            className='flex items-center justify-between gap-3 py-2'>
                            <span className='min-w-0'>
                                <span className='block truncate'>{x.name}</span>
                                <span className='block text-xs text-text-muted'>
                                    {x.sessions}{" "}
                                    {x.sessions === 1 ? "session" : "sessions"}{" "}
                                    · {x.sets} sets
                                    {!x.timed &&
                                        ` · ${x.volume.toLocaleString()} ${unit}`}
                                </span>
                            </span>
                            {x.bestWeight > 0 && (
                                <span className='shrink-0 text-right text-xs'>
                                    <span className='block tabular-nums'>
                                        best {x.bestWeight} {unit}
                                    </span>
                                    {x.sessions > 1 && change !== 0 && (
                                        <span
                                            className={`block tabular-nums ${
                                                change > 0
                                                    ? "text-emerald-500"
                                                    : "text-rose-500"
                                            }`}>
                                            {change > 0 ? "▲ +" : "▼ −"}
                                            {Math.abs(change)} since start
                                        </span>
                                    )}
                                </span>
                            )}
                        </li>
                    );
                })}
                {shown.length === 0 && (
                    <li className='py-2 text-xs text-text-muted'>
                        No exercises match “{query.trim()}”.
                    </li>
                )}
            </ul>
        </div>
    );
}
