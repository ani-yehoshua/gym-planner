"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ITEM_H = 40;
const VISIBLE = 5; // rows shown at once (odd, so one sits dead-center)
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;

function Wheel({
    values,
    value,
    onChange,
}: {
    values: number[];
    value: number;
    onChange: (v: number) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const idx = values.indexOf(value);
        if (ref.current && idx >= 0) ref.current.scrollTop = idx * ITEM_H;
        // only scroll to the starting position once, on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleScroll() {
        const el = ref.current;
        if (!el) return;
        if (settleRef.current) clearTimeout(settleRef.current);
        settleRef.current = setTimeout(() => {
            const idx = Math.min(
                values.length - 1,
                Math.max(0, Math.round(el.scrollTop / ITEM_H)),
            );
            el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
            onChange(values[idx]);
        }, 100);
    }

    return (
        <div
            className='relative overflow-hidden'
            style={{ height: ITEM_H * VISIBLE, width: 64 }}>
            <div
                ref={ref}
                onScroll={handleScroll}
                className='no-scrollbar h-full overflow-y-scroll'
                style={{ scrollSnapType: "y mandatory" }}>
                <div style={{ height: PAD }} />
                {values.map(v => (
                    <div
                        key={v}
                        className='flex items-center justify-center text-xl font-medium tabular-nums'
                        style={{
                            height: ITEM_H,
                            scrollSnapAlign: "center",
                        }}>
                        {String(v).padStart(2, "0")}
                    </div>
                ))}
                <div style={{ height: PAD }} />
            </div>
            <div
                className='pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-lg bg-surface-2/70'
                style={{ height: ITEM_H }}
            />
        </div>
    );
}

const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const SECONDS = Array.from({ length: 60 }, (_, i) => i);

/** Apple Clock-style duration picker: scrolling minute/second wheels in a
 *  bottom-sheet modal. */
export function TimeDialModal({
    initialSeconds,
    onConfirm,
    onClose,
}: {
    initialSeconds: number;
    onConfirm: (seconds: number) => void;
    onClose: () => void;
}) {
    const [minutes, setMinutes] = useState(
        Math.min(59, Math.floor(initialSeconds / 60)),
    );
    const [seconds, setSeconds] = useState(initialSeconds % 60);

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
                className='w-full max-w-xs rounded-2xl border border-border bg-bg p-5 shadow-xl'
                onClick={e => e.stopPropagation()}>
                <h2 className='text-center text-sm font-semibold'>
                    Set target
                </h2>

                <div className='relative mt-4 flex items-center justify-center'>
                    <Wheel
                        values={MINUTES}
                        value={minutes}
                        onChange={setMinutes}
                    />
                    <span className='px-1 text-xl text-text-muted'>:</span>
                    <Wheel
                        values={SECONDS}
                        value={seconds}
                        onChange={setSeconds}
                    />
                </div>
                <div className='mt-1 flex justify-center gap-1 text-[11px] uppercase text-text-muted'>
                    <span className='w-16 text-center'>min</span>
                    <span className='w-2' />
                    <span className='w-16 text-center'>sec</span>
                </div>

                <div className='mt-5 flex gap-2'>
                    <button
                        type='button'
                        onClick={onClose}
                        className='flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface'>
                        Cancel
                    </button>
                    <button
                        type='button'
                        onClick={() =>
                            onConfirm(Math.max(1, minutes * 60 + seconds))
                        }
                        className='flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg'>
                        Set
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
