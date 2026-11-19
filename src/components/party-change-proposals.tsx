"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { respondToPartyChanges } from "@/app/actions";
import { formatShort } from "@/lib/date";
import { formatRepRange } from "@/lib/programs";
import type { ProposalGroup, ProposalItem } from "@/lib/party-proposals";

const acceptCls =
    "rounded-md border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/25 disabled:opacity-50 dark:text-emerald-300";
const declineCls =
    "rounded-md border border-rose-500/50 bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-500/25 disabled:opacity-50 dark:text-rose-300";

/** "3 → 4 sets · 8–10 → 10–12 reps": just the parts that changed. */
function describe(it: ProposalItem) {
    const parts: string[] = [];
    if (it.newSets != null)
        parts.push(`${it.oldSets ?? "?"} → ${it.newSets} sets`);
    if (it.newRepMin != null || it.newRepMax != null) {
        const from = formatRepRange(it.oldRepMin, it.oldRepMax) || "—";
        const to =
            formatRepRange(
                it.newRepMin ?? it.oldRepMin,
                it.newRepMax ?? it.oldRepMax,
            ) || "—";
        parts.push(`${from} → ${to} reps`);
    }
    return parts.join(" · ");
}

/** Changes other party members made to a shared session, each one yours to
 *  accept (it changes your own targets for that exercise) or decline (your
 *  session stays as it is). Grouped by member and session. */
export function PartyChangeProposals({
    groups,
    showDay = false,
}: {
    groups: ProposalGroup[];
    /** name the session on each group (the Party page lists several) */
    showDay?: boolean;
}) {
    const [pending, start] = useTransition();
    // answered rows disappear right away; the refresh confirms it
    const [gone, setGone] = useState<string[]>([]);

    const answer = (ids: string[], accept: boolean, dayId: string) => {
        setGone(g => [...g, ...ids]);
        start(() => respondToPartyChanges(ids, accept, dayId));
    };

    const live = groups
        .map(g => ({ ...g, items: g.items.filter(i => !gone.includes(i.id)) }))
        .filter(g => g.items.length > 0);
    if (live.length === 0) return null;

    return (
        // capped in height, so a long list scrolls inside it (it can sit in a
        // sticky block that mustn't take over the screen)
        <section
            aria-label='Changes proposed by your party'
            className='flex max-h-[40vh] flex-col gap-3 overflow-y-auto rounded-xl border border-amber-400/60 bg-bg p-3'>
            {live.map(g => (
                <div
                    key={g.key}
                    className='flex flex-col gap-2'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <p className='text-sm'>
                            <span className='font-semibold'>{g.proposer}</span>{" "}
                            changed{" "}
                            {showDay ? (
                                <Link
                                    href={`/day/${g.dayId}`}
                                    className='underline'>
                                    {formatShort(g.dayDate)}
                                    {g.dayLabel && ` · ${g.dayLabel}`}
                                </Link>
                            ) : (
                                "this session"
                            )}
                        </p>
                        {g.items.length > 1 && (
                            <span className='flex gap-1.5'>
                                <button
                                    type='button'
                                    disabled={pending}
                                    onClick={() =>
                                        answer(
                                            g.items.map(i => i.id),
                                            true,
                                            g.dayId,
                                        )
                                    }
                                    className={acceptCls}>
                                    Accept all
                                </button>
                                <button
                                    type='button'
                                    disabled={pending}
                                    onClick={() =>
                                        answer(
                                            g.items.map(i => i.id),
                                            false,
                                            g.dayId,
                                        )
                                    }
                                    className={declineCls}>
                                    Decline all
                                </button>
                            </span>
                        )}
                    </div>
                    <ul className='flex flex-col divide-y divide-border rounded-lg border border-border bg-bg'>
                        {g.items.map(it => (
                            <li
                                key={it.id}
                                className='flex items-center justify-between gap-2 px-3 py-2'>
                                <span className='min-w-0'>
                                    <span className='block truncate text-sm'>
                                        {it.exerciseName}
                                    </span>
                                    <span className='block text-xs text-text-muted'>
                                        {describe(it)}
                                    </span>
                                </span>
                                <span className='flex shrink-0 gap-1.5'>
                                    <button
                                        type='button'
                                        disabled={pending}
                                        onClick={() =>
                                            answer([it.id], true, g.dayId)
                                        }
                                        className={acceptCls}>
                                        Accept
                                    </button>
                                    <button
                                        type='button'
                                        disabled={pending}
                                        onClick={() =>
                                            answer([it.id], false, g.dayId)
                                        }
                                        className={declineCls}>
                                        Decline
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </section>
    );
}
