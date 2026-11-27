"use client";

import { useState, useTransition } from "react";
import { slideProgramWeek } from "@/app/actions";
import { dayDiff } from "@/lib/date";

/** Move a program day (and the rest of its program week) later, for when a
 *  day has to be skipped: Thursday and Friday become Friday and Saturday, and
 *  the weeks after stay as they are. A missed day can go straight to today. */
export function SlideProgramDay({
    dayId,
    dayNumber,
    date,
    todayISO,
}: {
    dayId: string;
    dayNumber: number;
    date: string;
    todayISO: string;
}) {
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const behind = dayDiff(date, todayISO); // > 0: this day has gone by

    const slide = (days: number, what: string) => {
        if (
            !confirm(
                `Move Day ${dayNumber} ${what}, and the rest of this program week with it? The weeks after stay where they are.`,
            )
        )
            return;
        setError(null);
        start(async () => {
            const res = await slideProgramWeek(dayId, days);
            if (res.error) setError(res.error);
        });
    };

    return (
        <div
            className={`flex flex-col gap-2 rounded-lg border-2 px-3 py-2.5 ${
                behind > 0
                    ? "border-accent/60 bg-accent/10"
                    : "border-dashed border-border"
            }`}>
            <p className='text-sm'>
                <span className='font-semibold'>
                    {behind > 0
                        ? `Day ${dayNumber} was missed.`
                        : "Skipping this day?"}
                </span>{" "}
                <span className='text-text-muted'>
                    Slide it and the rest of this week later; the weeks after
                    stay put.
                </span>
            </p>
            <div className='flex flex-wrap gap-2'>
                {behind > 0 && (
                    <button
                        type='button'
                        disabled={pending}
                        onClick={() => slide(behind, "to today")}
                        className='rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50'>
                        Move to today
                    </button>
                )}
                <button
                    type='button'
                    disabled={pending}
                    onClick={() => slide(1, "a day later")}
                    className='rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50'>
                    {pending ? "Moving…" : "Push back a day"}
                </button>
            </div>
            {error && (
                <p className='text-xs text-rose-600 dark:text-rose-300'>
                    {error}
                </p>
            )}
        </div>
    );
}
