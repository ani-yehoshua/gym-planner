"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    addDays,
    dayOfMonth,
    dowShort,
    formatLong,
    formatRangeNumeric,
} from "@/lib/date";
import { formatSet } from "@/lib/format-set";
import { CATEGORY_LABEL, CATEGORY_STYLE, muscleLabel } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

export type HistoryDay = {
    id: string;
    date: string;
    category: Enums<"muscle_category"> | null;
    partyName: string | null;
    isDeload: boolean;
    /** reps-based volume only; timed sets are totalled separately */
    volume: number;
    timedVolume: number;
    exercisesDone: number;
    top: string | null;
    exercises: {
        name: string;
        muscles: string[];
        sets: { weight: number; reps: number }[];
        volume: number;
        timed: boolean;
        top: number;
    }[];
};

// Compare is a side-by-side view, so it only makes sense for a handful of
// days at once; export has no such limit.
const MAX_COMPARE = 4;

function csvCell(v: string | number) {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadText(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function exportDays(days: HistoryDay[], format: "csv" | "json") {
    if (days.length === 0) return;
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const range =
        sorted.length === 1
            ? sorted[0].date
            : `${sorted[0].date}_to_${sorted[sorted.length - 1].date}`;

    if (format === "json") {
        downloadText(
            JSON.stringify(sorted, null, 2),
            `gymplanner-history-${range}.json`,
            "application/json",
        );
        return;
    }

    const rows = [
        ["date", "category", "party", "exercise", "set", "weight", "reps"],
    ];
    for (const d of sorted) {
        for (const ex of d.exercises) {
            ex.sets.forEach((s, i) =>
                rows.push([
                    d.date,
                    d.category ?? "",
                    d.partyName ?? "",
                    ex.name,
                    String(i + 1),
                    String(s.weight),
                    String(s.reps),
                ]),
            );
        }
    }
    downloadText(
        rows.map(r => r.map(csvCell).join(",")).join("\n"),
        `gymplanner-history-${range}.csv`,
        "text/csv",
    );
}

export function HistoryList({
    weeks,
}: {
    weeks: { start: string; days: HistoryDay[] }[];
}) {
    const [selected, setSelected] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [muscle, setMuscle] = useState("");
    const allDays = weeks.flatMap(w => w.days);
    const byId = new Map(allDays.map(d => [d.id, d]));
    // oldest day first, left-to-right
    const chosen = selected
        .map(id => byId.get(id)!)
        .filter(Boolean)
        .sort((a, b) => a.date.localeCompare(b.date));

    // every primary muscle that shows up anywhere in history, for the filter chips
    const allMuscles = [
        ...new Set(
            weeks.flatMap(w =>
                w.days.flatMap(d => d.exercises.flatMap(e => e.muscles)),
            ),
        ),
    ].sort((a, b) => muscleLabel(a).localeCompare(muscleLabel(b)));

    const searching = query.trim() !== "" || muscle !== "";
    // exercise -> its sessions (newest first), filtered by name and/or muscle
    const results = (() => {
        if (!searching) return [];
        const q = query.trim().toLowerCase();
        const byName = new Map<
            string,
            {
                muscles: string[];
                sessions: {
                    day: HistoryDay;
                    ex: HistoryDay["exercises"][number];
                }[];
            }
        >();
        for (const d of weeks.flatMap(w => w.days)) {
            for (const ex of d.exercises) {
                if (q && !ex.name.toLowerCase().includes(q)) continue;
                if (muscle && !ex.muscles.includes(muscle)) continue;
                const g = byName.get(ex.name) ?? {
                    muscles: ex.muscles,
                    sessions: [],
                };
                g.sessions.push({ day: d, ex });
                byName.set(ex.name, g);
            }
        }
        return [...byName.entries()]
            .map(([name, g]) => ({
                name,
                muscles: g.muscles,
                sessions: g.sessions.sort((a, b) =>
                    b.day.date.localeCompare(a.day.date),
                ),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    })();

    function toggle(id: string) {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
        );
    }

    // lock background scroll while the compare modal is up
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    // Year > month > week. A week that straddles two months belongs wholly to
    // the earlier one (i.e. the month its Sunday start falls in).
    const MONTHS = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    const groups: {
        year: string;
        months: {
            key: string;
            label: string;
            weeks: { start: string; days: HistoryDay[] }[];
        }[];
    }[] = [];
    for (const w of weeks) {
        const year = w.start.slice(0, 4);
        const key = w.start.slice(0, 7);
        let y = groups.find(g => g.year === year);
        if (!y) groups.push((y = { year, months: [] }));
        let m = y.months.find(x => x.key === key);
        if (!m)
            y.months.push(
                (m = {
                    key,
                    label: MONTHS[Number(key.slice(5)) - 1],
                    weeks: [],
                }),
            );
        m.weeks.push(w);
    }

    const renderWeek = (
        w: { start: string; days: HistoryDay[] },
        first: boolean,
    ) => (
        <details
            key={w.start}
            open={first}
            className={first ? "" : "border-t border-border"}>
            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm'>
                <span className='flex items-center gap-1.5 font-medium'>
                    {formatRangeNumeric(w.start, addDays(w.start, 6))}
                    {w.days.some(d => d.isDeload) && (
                        <span className='rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300'>
                            Deload
                        </span>
                    )}
                </span>
                <span className='text-xs text-text-muted'>
                    {w.days.length} day{w.days.length === 1 ? "" : "s"} ▾
                </span>
            </summary>
            <ul className='flex flex-col gap-1 border-t border-border p-2'>
                {w.days.map(d => (
                    <li
                        key={d.id}
                        className='flex items-center gap-2'>
                        <input
                            type='checkbox'
                            checked={selected.includes(d.id)}
                            onChange={() => toggle(d.id)}
                            className='h-4 w-4 shrink-0 accent-[currentColor]'
                            aria-label='Select to compare'
                        />
                        <Link
                            href={`/day/${d.id}`}
                            className='flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface'>
                            <span className='w-9 shrink-0 text-center'>
                                <span className='block text-[10px] uppercase text-text-muted'>
                                    {dowShort(d.date)}
                                </span>
                                <span className='block font-semibold leading-none'>
                                    {dayOfMonth(d.date)}
                                </span>
                            </span>
                            {d.category && (
                                <span
                                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-xs ${CATEGORY_STYLE[d.category]}`}>
                                    {CATEGORY_LABEL[d.category]}
                                </span>
                            )}
                            {d.isDeload && (
                                <span className='shrink-0 rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-300'>
                                    Deload
                                </span>
                            )}
                            <span className='min-w-0 flex-1 truncate text-xs text-text-muted'>
                                {d.exercisesDone} ex
                                {d.top && <> · top {d.top}</>}
                                {d.partyName && <> · {d.partyName}</>}
                            </span>
                            <span className='shrink-0 text-xs text-text-muted'>
                                vol{" "}
                                <span className='text-text'>{d.volume}</span>
                                {d.timedVolume > 0 && (
                                    <>
                                        {" "}
                                        · timed{" "}
                                        <span className='text-text'>
                                            {d.timedVolume}
                                        </span>
                                    </>
                                )}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </details>
    );

    return (
        <>
            <div className='mb-2 flex flex-col gap-2'>
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search exercises you've done…"
                    className='w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted'
                />
                {allMuscles.length > 0 && (
                    <div className='flex gap-1.5 overflow-x-auto pb-0.5'>
                        {allMuscles.map(m => (
                            <button
                                key={m}
                                onClick={() =>
                                    setMuscle(cur => (cur === m ? "" : m))
                                }
                                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
                                    muscle === m
                                        ? "border-text bg-text text-bg"
                                        : "border-border text-text-muted hover:text-text"
                                }`}>
                                {muscleLabel(m)}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <details className='group relative mb-2'>
                <summary className='flex w-fit cursor-pointer list-none items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-text-muted hover:text-text'>
                    Export
                    <span className='transition-transform group-open:rotate-180'>
                        ▾
                    </span>
                </summary>
                <div className='absolute z-10 mt-1 w-56 rounded-lg border border-border bg-bg p-1 text-xs shadow-lg'>
                    <div className='px-2 py-1 text-[10px] uppercase tracking-wide text-text-muted'>
                        Selected ({selected.length})
                    </div>
                    <button
                        disabled={selected.length === 0}
                        onClick={() => exportDays(chosen, "csv")}
                        className='block w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent'>
                        as CSV
                    </button>
                    <button
                        disabled={selected.length === 0}
                        onClick={() => exportDays(chosen, "json")}
                        className='block w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent'>
                        as JSON
                    </button>
                    <div className='mt-1 border-t border-border px-2 pt-1.5 text-[10px] uppercase tracking-wide text-text-muted'>
                        All history ({allDays.length})
                    </div>
                    <button
                        onClick={() => exportDays(allDays, "csv")}
                        className='block w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2'>
                        as CSV
                    </button>
                    <button
                        onClick={() => exportDays(allDays, "json")}
                        className='block w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2'>
                        as JSON
                    </button>
                </div>
            </details>

            {searching && (
                <div className='max-h-[28rem] overflow-y-auto rounded-xl border border-border'>
                    {results.length === 0 ? (
                        <p className='p-3 text-sm text-text-muted'>
                            No matching exercises.
                        </p>
                    ) : (
                        results.map((g, gi) => (
                            <div
                                key={g.name}
                                className={
                                    gi > 0 ? "border-t border-border" : ""
                                }>
                                <div className='flex items-baseline justify-between gap-2 px-3 pt-2.5'>
                                    <span className='text-sm font-medium'>
                                        {g.name}
                                    </span>
                                    <span className='shrink-0 text-[11px] text-text-muted'>
                                        {g.sessions.length} session
                                        {g.sessions.length === 1 ? "" : "s"}
                                    </span>
                                </div>
                                <ul className='flex flex-col p-1.5'>
                                    {g.sessions.map(({ day, ex }) => (
                                        <li key={day.id}>
                                            <Link
                                                href={`/day/${day.id}`}
                                                className='flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-surface'>
                                                <span className='w-24 shrink-0 text-text-muted'>
                                                    {formatLong(day.date)}
                                                </span>
                                                <span className='min-w-0 flex-1 truncate'>
                                                    {ex.sets
                                                        .map(s =>
                                                            formatSet(
                                                                s.weight,
                                                                s.reps,
                                                                ex.timed,
                                                            ),
                                                        )
                                                        .join("  ·  ")}
                                                </span>
                                                {/* no top weight on a bodyweight exercise */}
                                                {ex.top > 0 && (
                                                    <span className='shrink-0 text-text-muted'>
                                                        top{" "}
                                                        <span className='text-text'>
                                                            {ex.top}
                                                        </span>
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
            )}

            <div
                className={`max-h-96 overflow-y-auto overflow-x-hidden rounded-xl border border-border ${
                    searching ? "hidden" : ""
                }`}>
                {groups.map((y, yi) => (
                    <details
                        key={y.year}
                        open={yi === 0}
                        className={yi > 0 ? "border-t border-border" : ""}>
                        <summary className='flex cursor-pointer list-none items-center justify-between bg-surface/60 px-3 py-2 text-sm font-semibold'>
                            {y.year}
                            <span className='text-xs font-normal text-text-muted'>
                                {y.months.reduce(
                                    (n, m) =>
                                        n +
                                        m.weeks.reduce(
                                            (k, w) => k + w.days.length,
                                            0,
                                        ),
                                    0,
                                )}{" "}
                                days ▾
                            </span>
                        </summary>
                        {y.months.map((m, mi) => (
                            <details
                                key={m.key}
                                open={yi === 0 && mi === 0}
                                className='border-t border-border'>
                                <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium'>
                                    {m.label}
                                    <span className='text-xs font-normal text-text-muted'>
                                        {m.weeks.reduce(
                                            (k, w) => k + w.days.length,
                                            0,
                                        )}{" "}
                                        days ▾
                                    </span>
                                </summary>
                                <div className='border-t border-border pl-2'>
                                    {m.weeks.map((w, wi) => (
                                        <div key={w.start}>
                                            {renderWeek(
                                                w,
                                                yi === 0 &&
                                                    mi === 0 &&
                                                    wi === 0,
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        ))}
                    </details>
                ))}
            </div>

            {!searching && selected.length > 0 && (
                <div className='mt-2 flex flex-wrap items-center gap-3 text-xs'>
                    <button
                        onClick={() => setOpen(true)}
                        disabled={
                            selected.length < 2 || selected.length > MAX_COMPARE
                        }
                        title={
                            selected.length > MAX_COMPARE
                                ? `Compare up to ${MAX_COMPARE} days at once`
                                : undefined
                        }
                        className='rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-fg disabled:opacity-40'>
                        Compare {selected.length}
                    </button>
                    {selected.length > MAX_COMPARE && (
                        <span className='text-text-muted'>
                            compare up to {MAX_COMPARE} — export has no limit
                        </span>
                    )}
                    <button
                        onClick={() => setSelected([])}
                        className='text-text-muted hover:text-text'>
                        Clear
                    </button>
                </div>
            )}

            {open && chosen.length >= 2 && (
                <div
                    className='fixed inset-0 z-50 flex touch-none items-end justify-center overscroll-contain bg-black/50 p-2 sm:items-center'
                    onClick={() => setOpen(false)}>
                    <div
                        className='flex max-h-[85vh] w-full max-w-3xl touch-auto flex-col overflow-hidden overscroll-contain rounded-2xl border border-border bg-bg'
                        onClick={e => e.stopPropagation()}>
                        <div className='flex items-center justify-between border-b border-border px-4 py-3'>
                            <span className='text-sm font-semibold'>
                                Comparing {chosen.length} days
                            </span>
                            <button
                                onClick={() => setOpen(false)}
                                className='text-sm text-text-muted hover:text-text'>
                                Close
                            </button>
                        </div>

                        <div className='flex gap-3 overflow-auto overscroll-contain p-4'>
                            {chosen.map(d => (
                                <div
                                    key={d.id}
                                    className='w-56 shrink-0'>
                                    <div className='mb-1 text-sm font-semibold'>
                                        {formatLong(d.date)}
                                    </div>
                                    <div className='mb-2 flex flex-wrap items-center gap-1.5 text-xs text-text-muted'>
                                        {d.category && (
                                            <span
                                                className={`rounded-md border px-1.5 py-0.5 ${CATEGORY_STYLE[d.category]}`}>
                                                {CATEGORY_LABEL[d.category]}
                                            </span>
                                        )}
                                        {d.isDeload && (
                                            <span className='rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-amber-600 dark:text-amber-300'>
                                                Deload
                                            </span>
                                        )}
                                        <span>
                                            vol {d.volume}
                                            {d.timedVolume > 0 && (
                                                <> · timed {d.timedVolume}</>
                                            )}
                                        </span>
                                        {d.partyName && (
                                            <span>· {d.partyName}</span>
                                        )}
                                    </div>
                                    <ul className='flex flex-col gap-2'>
                                        {d.exercises.map((ex, i) => (
                                            <li
                                                key={i}
                                                className='rounded-lg border border-border p-2 text-xs'>
                                                <div className='font-medium'>
                                                    {ex.name}
                                                </div>
                                                <div className='mt-1 flex flex-col gap-0.5 text-text-muted'>
                                                    {ex.sets.map((s, si) => (
                                                        <div key={si}>
                                                            {formatSet(
                                                                s.weight,
                                                                s.reps,
                                                                ex.timed,
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                {ex.top > 0 && (
                                                    <div className='mt-1 font-semibold text-text'>
                                                        top {ex.top} · vol{" "}
                                                        {ex.volume}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}

                            {chosen.length >= 2 &&
                                (() => {
                                    const oldest = chosen[0];
                                    const newest = chosen[chosen.length - 1];
                                    const oldMap = new Map(
                                        oldest.exercises.map(e => [e.name, e]),
                                    );
                                    const rows = newest.exercises
                                        .filter(e => oldMap.has(e.name))
                                        .map(nw => {
                                            const od = oldMap.get(nw.name)!;
                                            return {
                                                name: nw.name,
                                                dTop: nw.top - od.top,
                                                dVol: nw.volume - od.volume,
                                            };
                                        });
                                    const totalDVol =
                                        newest.volume - oldest.volume;
                                    const sign = (n: number) =>
                                        `${n > 0 ? "+" : ""}${n.toLocaleString()}`;
                                    const tone = (n: number) =>
                                        n > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : n < 0
                                              ? "text-rose-600 dark:text-rose-400"
                                              : "text-text-muted";
                                    return (
                                        <div className='w-56 shrink-0 border-l border-border pl-3'>
                                            <div className='mb-1 text-sm font-semibold'>
                                                Change
                                            </div>
                                            <div className='mb-2 text-xs text-text-muted'>
                                                {oldest.date.slice(5)} →{" "}
                                                {newest.date.slice(5)}
                                            </div>
                                            <div
                                                className={`mb-2 text-xs font-semibold ${tone(totalDVol)}`}>
                                                session volume {sign(totalDVol)}
                                            </div>
                                            {(oldest.timedVolume > 0 ||
                                                newest.timedVolume > 0) && (
                                                <div
                                                    className={`mb-2 text-xs font-semibold ${tone(
                                                        newest.timedVolume -
                                                            oldest.timedVolume,
                                                    )}`}>
                                                    timed volume{" "}
                                                    {sign(
                                                        newest.timedVolume -
                                                            oldest.timedVolume,
                                                    )}
                                                </div>
                                            )}
                                            <ul className='flex flex-col gap-2'>
                                                {rows.length === 0 && (
                                                    <li className='text-xs text-text-muted'>
                                                        No exercises in common.
                                                    </li>
                                                )}
                                                {rows.map((r, i) => (
                                                    <li
                                                        key={i}
                                                        className='rounded-lg border border-border p-2 text-xs'>
                                                        <div className='font-medium'>
                                                            {r.name}
                                                        </div>
                                                        <div
                                                            className={`mt-1 ${tone(r.dTop)}`}>
                                                            top {sign(r.dTop)}
                                                        </div>
                                                        <div
                                                            className={tone(
                                                                r.dVol,
                                                            )}>
                                                            vol {sign(r.dVol)}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })()}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
