"use client";

import { useState } from "react";

const PHRASES = [
    "Benching…",
    "Bulking…",
    "Chalking up…",
    "Counting reps…",
    "Curling…",
    "Cutting…",
    "Hydrating…",
    "Loading bar…",
    "Planning…",
    "Pressing…",
    "Pronating…",
    "Pumping…",
    "Racking plates…",
    "Rolling out mat…",
    "Setting PR…",
    "Setting up rack…",
    "Spotting…",
    "Squatting…",
    "Stretching…",
    "Supinating…",
    "Supplementing…",
    "Sweating…",
    "Tightening belt…",
    "Training…",
    "Warming up…",
];

export function LoadingSpinner() {
    const [text] = useState(
        () => PHRASES[Math.floor(Math.random() * PHRASES.length)],
    );

    return (
        <div className='flex min-h-[60vh] flex-col items-center justify-center gap-3'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-border border-t-text-muted' />
            <span
                className='text-xs text-text-muted'
                suppressHydrationWarning>
                {text}
            </span>
        </div>
    );
}
