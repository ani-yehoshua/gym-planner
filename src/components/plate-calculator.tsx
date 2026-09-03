"use client";

import { useState } from "react";

type Plate = { label: string; value: number };

const PLATES: Plate[] = [
    { label: "Bar", value: 45 },
    { label: "45", value: 45 },
    { label: "35", value: 35 },
    { label: "25", value: 25 },
    { label: "10", value: 10 },
    { label: "5", value: 5 },
    { label: "2.5", value: 2.5 },
];

export function PlateCalculator() {
    // each entry is an index into PLATES, in click order
    const [picked, setPicked] = useState<number[]>([]);
    const [bw, setBw] = useState("");

    const bwNum = bw === "" ? 0 : Number(bw) || 0;
    const total =
        picked.reduce((sum, i) => sum + PLATES[i].value, 0) + bwNum;
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

    return (
        <details className='rounded-xl border border-border bg-bg shadow-sm'>
            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm'>
                <span className='font-medium'>Plate calculator</span>
                <span className='text-xs text-text-muted'>
                    {picked.length > 0 ? `${fmt(total)} lb ▾` : "▾"}
                </span>
            </summary>

            <div className='flex flex-col gap-3 border-t border-border p-3'>
                <label className='flex items-center gap-2 text-sm text-text-muted'>
                    Bodyweight (optional)
                    <input
                        inputMode='decimal'
                        value={bw}
                        onChange={e => setBw(e.target.value)}
                        placeholder='—'
                        className='w-20 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm'
                    />
                </label>

                <div className='flex flex-wrap gap-1.5'>
                    {PLATES.map((p, i) => (
                        <button
                            key={p.label}
                            type='button'
                            onClick={() => setPicked(prev => [...prev, i])}
                            className='rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-2'>
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className='flex items-center gap-2'>
                    <div className='flex flex-1 flex-wrap items-center gap-1 overflow-x-auto text-sm'>
                        {picked.length === 0 && bwNum === 0 ? (
                            <span className='text-text-muted'>
                                Tap plates to add them up.
                            </span>
                        ) : (
                            <>
                            {bwNum > 0 && (
                                <span className='rounded-md border border-border bg-surface-2 px-2 py-0.5'>
                                    BW {fmt(bwNum)}
                                </span>
                            )}
                            {picked.map((plateIdx, pos) => (
                                <span
                                    key={pos}
                                    className='flex items-center'>
                                    {(pos > 0 || bwNum > 0) && (
                                        <span className='mx-1 text-text-muted'>
                                            +
                                        </span>
                                    )}
                                    <button
                                        type='button'
                                        onClick={() =>
                                            setPicked(prev =>
                                                prev.filter(
                                                    (_, p) => p !== pos,
                                                ),
                                            )
                                        }
                                        title='Remove'
                                        className='rounded-md border border-border bg-surface-2 px-2 py-0.5 hover:border-rose-400 hover:text-rose-400'>
                                        {fmt(PLATES[plateIdx].value)}
                                    </button>
                                </span>
                            ))}
                            </>
                        )}
                    </div>

                    {total > 0 && (
                        <div className='flex items-center gap-2'>
                            <span className='whitespace-nowrap text-sm font-semibold'>
                                = {fmt(total)} lb
                            </span>
                            <button
                                type='button'
                                onClick={() => {
                                    setPicked([]);
                                    setBw("");
                                }}
                                className='rounded-md border border-border px-2 py-0.5 text-xs text-text-muted hover:text-text'>
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </details>
    );
}
