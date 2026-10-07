"use client";

import { useEffect } from "react";

/** Turns off iOS "shake to undo". Safari reports the shake as an undo/redo
 *  edit on whichever text field is focused, so cancelling those edits stops the
 *  "Undo Typing" prompt from wiping a weight or rep someone just entered.
 *  Mounted once in the root layout. */
export function NoShakeUndo() {
    useEffect(() => {
        const block = (e: Event) => {
            const type = (e as InputEvent).inputType;
            if (type === "historyUndo" || type === "historyRedo")
                e.preventDefault();
        };
        document.addEventListener("beforeinput", block, true);
        return () => document.removeEventListener("beforeinput", block, true);
    }, []);

    return null;
}
