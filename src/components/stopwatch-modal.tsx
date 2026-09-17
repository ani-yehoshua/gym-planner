"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TimeDialModal } from "@/components/time-dial";
import { formatDuration } from "@/lib/duration";

/** Full-screen-ish stopwatch face — big elapsed readout, a big round Start/
 *  Pause button, Stop & log to the side. Closing this doesn't stop the
 *  stopwatch; the running state lives in the caller, so reopening it picks
 *  up wherever it was. */
export function StopwatchModal({
    elapsed,
    running,
    targetSeconds,
    onToggleRun,
    onStopLog,
    onChangeTarget,
    onClose,
}: {
    elapsed: number;
    running: boolean;
    targetSeconds: number;
    onToggleRun: () => void;
    onStopLog: () => void;
    onChangeTarget: (seconds: number) => void;
    onClose: () => void;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const idle = elapsed === 0 && !running;

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    return createPortal(
        <div
            className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center'
            onClick={onClose}>
            <div
                className='w-full max-w-xs rounded-2xl border border-border bg-bg p-6 text-center shadow-xl'
                onClick={e => e.stopPropagation()}>
                <div className='flex items-center justify-between'>
                    <button
                        type='button'
                        onClick={() => idle && setPickerOpen(true)}
                        disabled={!idle}
                        className='text-xs text-text-muted enabled:hover:text-text disabled:opacity-40'>
                        target {formatDuration(targetSeconds)}
                    </button>
                    <button
                        type='button'
                        onClick={onClose}
                        className='text-xs text-text-muted hover:text-text'>
                        Close
                    </button>
                </div>

                <div className='my-8 font-mono text-5xl font-semibold tabular-nums'>
                    {formatDuration(elapsed)}
                </div>

                <div className='flex items-center justify-center gap-4'>
                    {elapsed > 0 && (
                        <button
                            type='button'
                            onClick={onStopLog}
                            className='rounded-full border border-border px-4 py-3 text-xs font-medium text-text-muted hover:text-text'>
                            Stop &amp; log
                        </button>
                    )}
                    <button
                        type='button'
                        onClick={onToggleRun}
                        className={`flex h-20 w-20 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                            running
                                ? "border-2 border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-300"
                                : "bg-primary text-primary-fg"
                        }`}>
                        {running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
                    </button>
                </div>
            </div>

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
        </div>,
        document.body,
    );
}
