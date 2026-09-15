"use client";

import { useEffect, useRef, useState } from "react";

function beep() {
    try {
        type WindowWithWebkitAudio = typeof window & {
            webkitAudioContext?: typeof AudioContext;
        };
        const w = window as WindowWithWebkitAudio;
        const Ctx = window.AudioContext ?? w.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch {
        /* no-op */
    }
}

function fmt(s: number) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
}

/** A countdown timer seeded from a target duration. Stopping (or finishing)
 *  reports how many seconds actually elapsed so the caller can drop it
 *  straight into a set. */
export function ExerciseTimer({
    target,
    onFinish,
    onClose,
}: {
    target: number;
    onFinish: (elapsedSeconds: number) => void;
    onClose: () => void;
}) {
    const [remaining, setRemaining] = useState(target);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!running) return;
        tickRef.current = setInterval(() => {
            setRemaining(r => {
                if (r <= 1) {
                    if (tickRef.current) clearInterval(tickRef.current);
                    setRunning(false);
                    setDone(true);
                    try {
                        navigator.vibrate?.(200);
                    } catch {
                        /* no-op */
                    }
                    beep();
                    return 0;
                }
                return r - 1;
            });
        }, 1000);
        return () => {
            if (tickRef.current) clearInterval(tickRef.current);
        };
    }, [running]);

    const elapsed = target - remaining;

    return (
        <div className='mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm'>
            <span className='w-12 font-mono text-lg font-semibold tabular-nums'>
                {fmt(remaining)}
            </span>
            {!running && !done && (
                <button
                    type='button'
                    onClick={() => setRunning(true)}
                    className='rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-fg'>
                    {elapsed > 0 ? "Resume" : "Start"}
                </button>
            )}
            {running && (
                <button
                    type='button'
                    onClick={() => setRunning(false)}
                    className='rounded-md border border-border px-3 py-1 text-xs'>
                    Pause
                </button>
            )}
            <button
                type='button'
                onClick={() => onFinish(Math.max(1, elapsed || target))}
                className='rounded-md border border-border px-3 py-1 text-xs text-text-muted hover:text-text'>
                {done ? "Log it" : "Stop & log"}
            </button>
            <button
                type='button'
                onClick={onClose}
                className='ml-auto text-xs text-text-muted hover:text-text'>
                Close
            </button>
        </div>
    );
}
