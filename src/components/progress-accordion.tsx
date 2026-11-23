"use client";

import { useEffect, useState, type ReactNode } from "react";

const STORE_KEY = "gymplanner:progressOpen";

export type AccordionSection = {
    id: string;
    title: string;
    /** a short note shown on the closed header ("Latest 182 lb") */
    summary?: string;
    content: ReactNode;
};

/** A list of sections where only one is open at a time. Closed sections stay
 *  mounted (just hidden), so whatever you'd typed or selected in one is still
 *  there when you come back to it. The open one is remembered per browser. */
export function ProgressAccordion({
    sections,
    defaultOpen,
}: {
    sections: AccordionSection[];
    defaultOpen: string;
}) {
    const [openId, setOpenId] = useState<string | null>(defaultOpen);

    useEffect(() => {
        const restore = () => {
            try {
                const saved = localStorage.getItem(STORE_KEY);
                if (saved === "" || sections.some(s => s.id === saved))
                    setOpenId(saved === "" ? null : saved);
            } catch {
                /* no-op */
            }
        };
        restore();
        // sections only supplies the ids, which don't change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggle = (id: string) => {
        const next = openId === id ? null : id;
        setOpenId(next);
        try {
            localStorage.setItem(STORE_KEY, next ?? "");
        } catch {
            /* no-op */
        }
    };

    return (
        <div className='flex flex-col gap-2'>
            {sections.map(s => {
                const open = openId === s.id;
                return (
                    <section
                        key={s.id}
                        className='rounded-xl border border-border'>
                        <h2>
                            <button
                                type='button'
                                id={`progress-${s.id}-button`}
                                aria-expanded={open}
                                aria-controls={`progress-${s.id}-panel`}
                                onClick={() => toggle(s.id)}
                                className='flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium'>
                                <span>{s.title}</span>
                                <span className='flex shrink-0 items-center gap-2 text-xs font-normal text-text-muted'>
                                    {!open && s.summary}
                                    <span aria-hidden>{open ? "▴" : "▾"}</span>
                                </span>
                            </button>
                        </h2>
                        <div
                            id={`progress-${s.id}-panel`}
                            role='region'
                            aria-labelledby={`progress-${s.id}-button`}
                            hidden={!open}
                            className='border-t border-border p-4'>
                            {s.content}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
