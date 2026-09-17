"use client";

import { useEffect, useRef, useState } from "react";
import { StopwatchModal } from "@/components/stopwatch-modal";
import { formatStopwatch } from "@/lib/duration";

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

/** A "Stopwatch" button on the exercise card — tapping it opens the actual
 *  stopwatch face (StopwatchModal), Apple/Google-clock style. The running
 *  state lives here, not in the modal, so closing the modal mid-hold doesn't
 *  stop the count; the button itself shows the live time while it runs.
 *  Tracks real elapsed milliseconds (via timestamps, not a per-tick counter)
 *  so the centisecond readout doesn't drift. */
export function ExerciseTimer({
    targetSeconds,
    onChangeTarget,
    onFinish,
}: {
    targetSeconds: number;
    onChangeTarget: (seconds: number) => void;
    onFinish: (elapsedSeconds: number) => void;
}) {
    const [elapsedMs, setElapsedMs] = useState(0);
    const [running, setRunning] = useState(false);
    const [open, setOpen] = useState(false);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const runStartRef = useRef(0); // performance.now() when this run segment began
    const baseMsRef = useRef(0); // accumulated ms from earlier run segments
    const alertedRef = useRef(false);

    useEffect(() => {
        if (!running) return;
        runStartRef.current = performance.now();
        tickRef.current = setInterval(() => {
            const ms = baseMsRef.current + (performance.now() - runStartRef.current);
            setElapsedMs(ms);
            if (ms >= targetSeconds * 1000 && !alertedRef.current) {
                alertedRef.current = true;
                try {
                    navigator.vibrate?.(200);
                } catch {
                    /* no-op */
                }
                beep();
            }
        }, 40);
        return () => {
            if (tickRef.current) clearInterval(tickRef.current);
        };
    }, [running, targetSeconds]);

    function toggleRun() {
        setRunning(r => {
            if (r) baseMsRef.current = elapsedMs; // pausing: freeze where we are
            return !r;
        });
    }

    function reset() {
        setElapsedMs(0);
        setRunning(false);
        baseMsRef.current = 0;
        alertedRef.current = false;
    }

    return (
        <>
            <button
                type='button'
                onClick={() => setOpen(true)}
                className='flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2'>
                {running && (
                    <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-accent' />
                )}
                {elapsedMs > 0 ? formatStopwatch(elapsedMs) : "Stopwatch"}
            </button>

            {open && (
                <StopwatchModal
                    elapsedMs={elapsedMs}
                    running={running}
                    targetSeconds={targetSeconds}
                    onToggleRun={toggleRun}
                    onStopLog={() => {
                        onFinish(Math.round(elapsedMs / 1000));
                        reset();
                        setOpen(false);
                    }}
                    onChangeTarget={onChangeTarget}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}
