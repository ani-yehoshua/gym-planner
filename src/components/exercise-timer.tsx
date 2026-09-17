"use client";

import { useEffect, useRef, useState } from "react";
import { TimeDialModal } from "@/components/time-dial";
import { formatDuration } from "@/lib/duration";

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

/** The always-visible timer for a time-based exercise: a tappable duration
 *  (opens the dial picker while idle), Start/Pause, and Stop & log. No more
 *  separate "reveal the timer" step — this row *is* the timer. */
export function ExerciseTimer({
    targetSeconds,
    onChangeTarget,
    onFinish,
}: {
    targetSeconds: number;
    onChangeTarget: (seconds: number) => void;
    onFinish: (elapsedSeconds: number) => void;
}) {
    const [elapsed, setElapsed] = useState(0);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!running) return;
        tickRef.current = setInterval(() => {
            setElapsed(e => {
                const next = e + 1;
                if (next >= targetSeconds) {
                    if (tickRef.current) clearInterval(tickRef.current);
                    setRunning(false);
                    setDone(true);
                    try {
                        navigator.vibrate?.(200);
                    } catch {
                        /* no-op */
                    }
                    beep();
                    return targetSeconds;
                }
                return next;
            });
        }, 1000);
        return () => {
            if (tickRef.current) clearInterval(tickRef.current);
        };
    }, [running, targetSeconds]);

    const remaining = Math.max(0, targetSeconds - elapsed);
    const idle = elapsed === 0 && !running && !done;

    function reset() {
        setElapsed(0);
        setRunning(false);
        setDone(false);
    }

    return (
        <div className='flex items-center gap-2'>
            <button
                type='button'
                onClick={() => idle && setPickerOpen(true)}
                disabled={!idle}
                title={idle ? "Set duration" : undefined}
                className='w-16 rounded-md border border-border bg-surface px-2 py-1.5 text-center font-mono text-base font-semibold tabular-nums enabled:hover:border-text-muted disabled:opacity-100'>
                {formatDuration(remaining)}
            </button>
            {!done && (
                <button
                    type='button'
                    onClick={() => setRunning(r => !r)}
                    className='rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg'>
                    {running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
                </button>
            )}
            {elapsed > 0 && (
                <button
                    type='button'
                    onClick={() => {
                        onFinish(done ? targetSeconds : elapsed);
                        reset();
                    }}
                    className='rounded-md border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text'>
                    Stop &amp; log
                </button>
            )}
            {pickerOpen && (
                <TimeDialModal
                    initialSeconds={targetSeconds}
                    onConfirm={secs => {
                        onChangeTarget(secs);
                        setPickerOpen(false);
                    }}
                    onClose={() => setPickerOpen(false)}
                />
            )}
        </div>
    );
}
