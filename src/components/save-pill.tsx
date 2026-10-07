"use client";

import { useEffect, useState } from "react";

type SaveState = "saving" | "saved" | "error";

const EVENT = "gymplanner:save";

/** Tell the page's <SavePillHost /> where a save is at. Goes through a window
 *  event rather than component state because the thing that saved (a form
 *  that remounts when its saved values change) is often gone by the time the
 *  save lands. */
export function announceSave(state: SaveState) {
    window.dispatchEvent(new CustomEvent<SaveState>(EVENT, { detail: state }));
}

/** The big "Saving… / Saved ✓" pill pinned above the bottom nav, same look as
 *  the one on the day page. Mount once per page that has saves. */
export function SavePillHost() {
    const [state, setState] = useState<SaveState | null>(null);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onSave = (e: Event) => {
            const next = (e as CustomEvent<SaveState>).detail;
            clearTimeout(timer);
            setState(next);
            // "saving" stays until the result comes in; results fade after a beat
            if (next !== "saving")
                timer = setTimeout(() => setState(null), 1600);
        };
        window.addEventListener(EVENT, onSave);
        return () => {
            window.removeEventListener(EVENT, onSave);
            clearTimeout(timer);
        };
    }, []);

    if (!state) return null;
    return (
        <span
            role='status'
            className={`fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 rounded-full border px-5 py-2 text-sm font-medium shadow-lg ${
                state === "error"
                    ? "border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-300"
                    : "border-border bg-surface-2 text-text-muted"
            }`}>
            {state === "saving"
                ? "Saving…"
                : state === "saved"
                  ? "Saved ✓"
                  : "Couldn't save"}
        </span>
    );
}
