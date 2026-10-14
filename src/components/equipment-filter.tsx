"use client";

import { EQUIPMENT } from "@/lib/equipment";

/** Chips to narrow an exercise list by equipment. Tap to turn one on, tap again
 *  to turn it off; with several on, an exercise matches any of them. */
export function EquipmentFilter({
    selected,
    onChange,
}: {
    selected: string[];
    onChange: (next: string[]) => void;
}) {
    return (
        <div
            className='flex gap-1.5 overflow-x-auto pb-0.5'
            role='group'
            aria-label='Filter by equipment'>
            {EQUIPMENT.map(e => {
                const on = selected.includes(e.id);
                return (
                    <button
                        key={e.id}
                        type='button'
                        aria-pressed={on}
                        onClick={() =>
                            onChange(
                                on
                                    ? selected.filter(x => x !== e.id)
                                    : [...selected, e.id],
                            )
                        }
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
                            on
                                ? "border-text bg-text text-bg"
                                : "border-border text-text-muted hover:text-text"
                        }`}>
                        {e.label}
                    </button>
                );
            })}
            {selected.length > 0 && (
                <button
                    type='button'
                    onClick={() => onChange([])}
                    className='shrink-0 px-1.5 text-xs text-text-muted hover:text-text'>
                    Clear
                </button>
            )}
        </div>
    );
}
