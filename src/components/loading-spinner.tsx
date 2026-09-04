"use client";

import { useState } from "react";

const PHRASES = [
    "Chalking up…",
    "Racking plates…",
    "Loading bar…",
    "Warming up…",
    "Counting reps…",
    "Spotting…",
    "Setting PR…",
    "Tightening belt…",
    "Setting up rack…",
    "Rolling out mat…",
    "Pumping…",
    "Curling…",
    "Supplementing…",
    "Training…",
    "Hydrating…",
    "Pronating…",
    "Supinating…",
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
