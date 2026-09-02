"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    addExerciseToDay,
    logSet,
    removeDayExercise,
    reorderDayExercise,
    saveExerciseNote,
    setDayCategory,
    updateDayExerciseTarget,
} from "@/app/actions";
import {
    CATEGORY_LABEL,
    CATEGORY_STYLE,
    DAY_CATEGORY_CHOICES,
    muscleList,
    dayAcceptsExercise,
} from "@/lib/labels";
import { isCompound, suggestedSets, type Goal } from "@/lib/targets";
import { ExerciseDetailBody } from "@/components/exercise-detail";
import { PlateCalculator } from "@/components/plate-calculator";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/lib/supabase/database.types";

type Cat = Enums<"muscle_category">;
type CatalogItem = {
    id: string;
    name: string;
    category: Cat;
    primary_muscles: string[];
    secondary_muscles: string[];
    howto_text: string | null;
    media_url: string | null;
};
type DayEx = {
    id: string;
    targetSets: number;
    targetRepMin: number | null;
    targetRepMax: number | null;
    targetWeight: number | null;
    addedBy: string | null;
    exercise: CatalogItem;
};
type LogRow = {
    planned_day_exercise_id: string;
    user_id: string;
    set_no: number;
    weight: number | null;
    reps: number | null;
    volume: number | null;
};
type Member = { user_id: string; display_name: string | null; color: string };
type NoteRow = {
    planned_day_exercise_id: string;
    user_id: string;
    note: string;
};

const TrashIcon = () => (
    <svg
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='h-3.5 w-3.5'>
        <path d='M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' />
        <path d='M10 11v6M14 11v6' />
    </svg>
);

export default function DayEditor({
    day,
    currentUserId,
    canManageAll,
    members,
    logs,
    notes,
    catalog,
    goal,
    experience,
}: {
    day: {
        id: string;
        category: Cat | null;
        partyId: string | null;
        exercises: DayEx[];
    };
    currentUserId: string;
    canManageAll: boolean;
    members: Member[];
    logs: LogRow[];
    notes: NoteRow[];
    catalog: CatalogItem[];
    goal: string | null;
    experience: Enums<"experience_level"> | null;
}) {
    const [pending, start] = useTransition();
    const router = useRouter();

    const initial = useMemo(() => {
        const m = new Map<string, { weight: string; reps: string }>();
        for (const l of logs) {
            if (l.user_id !== currentUserId) continue;
            m.set(`${l.planned_day_exercise_id}:${l.set_no}`, {
                weight: l.weight?.toString() ?? "",
                reps: l.reps?.toString() ?? "",
            });
        }
        return m;
    }, [logs, currentUserId]);

    const [values, setValues] = useState(initial);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [query, setQuery] = useState("");
    const [showAdd, setShowAdd] = useState(day.exercises.length === 0);

    // ---- realtime: refresh when a party-mate changes this day ----------------
    useEffect(() => {
        if (!day.partyId) return;
        const supabase = createClient();
        const channel = supabase
            .channel(`day:${day.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "planned_day_exercises",
                    filter: `planned_day_id=eq.${day.id}`,
                },
                () => router.refresh(),
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "set_logs" },
                () => router.refresh(),
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "day_exercise_notes" },
                () => router.refresh(),
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [day.id, day.partyId, router]);

    const memberById = new Map(members.map(m => [m.user_id, m]));

    const myNote = (pdeId: string) =>
        notes.find(
            n =>
                n.planned_day_exercise_id === pdeId &&
                n.user_id === currentUserId,
        )?.note ?? "";
    const otherNotes = (pdeId: string) =>
        notes.filter(
            n =>
                n.planned_day_exercise_id === pdeId &&
                n.user_id !== currentUserId &&
                n.note.trim() !== "",
        );

    function cell(pdeId: string, setNo: number) {
        return values.get(`${pdeId}:${setNo}`) ?? { weight: "", reps: "" };
    }
    function update(
        pdeId: string,
        setNo: number,
        f: "weight" | "reps",
        raw: string,
    ) {
        const key = `${pdeId}:${setNo}`;
        setValues(prev =>
            new Map(prev).set(key, { ...cell(pdeId, setNo), [f]: raw }),
        );
    }
    function persist(pdeId: string, setNo: number) {
        const c = cell(pdeId, setNo);
        start(() =>
            logSet({
                pdeId,
                dayId: day.id,
                setNo,
                weight: c.weight === "" ? null : Number(c.weight),
                reps: c.reps === "" ? null : Number(c.reps),
            }),
        );
    }

    function maxLoggedSet(pdeId: string) {
        let max = 0;
        for (const l of logs) {
            if (
                l.planned_day_exercise_id === pdeId &&
                l.user_id === currentUserId &&
                l.set_no > max
            ) {
                max = l.set_no;
            }
        }
        return max;
    }
    function rowsFor(ex: DayEx) {
        return Math.max(ex.targetSets, maxLoggedSet(ex.id), 1);
    }
    function myStats(ex: DayEx) {
        let volume = 0;
        let top = 0;
        for (let s = 1; s <= rowsFor(ex); s++) {
            const c = values.get(`${ex.id}:${s}`);
            if (!c || c.weight === "" || c.reps === "") continue;
            const w = Number(c.weight);
            volume += w * Number(c.reps);
            if (w > top) top = w;
        }
        return { volume, top };
    }
    function otherStats(pdeId: string, userId: string) {
        let volume = 0;
        let top = 0;
        for (const l of logs) {
            if (l.planned_day_exercise_id !== pdeId || l.user_id !== userId)
                continue;
            if (l.weight != null && l.reps != null) {
                volume += l.weight * l.reps;
                if (l.weight > top) top = l.weight;
            }
        }
        return { volume, top };
    }

    function memberDayTotals(userId: string) {
        let volume = 0;
        let exercisesLogged = 0;
        for (const ex of day.exercises) {
            const s =
                userId === currentUserId
                    ? myStats(ex)
                    : otherStats(ex.id, userId);
            volume += s.volume;
            if (s.volume > 0) exercisesLogged++;
        }
        return { volume, exercisesLogged };
    }

    function setTarget(
        pdeId: string,
        patch: {
            sets?: number;
            repMin?: number;
            repMax?: number;
            weight?: number | null;
        },
    ) {
        start(() =>
            updateDayExerciseTarget({ pdeId, dayId: day.id, ...patch }),
        );
    }

    function tryAdd(item: CatalogItem) {
        if (!dayAcceptsExercise(day.category, item.category)) {
            const dayName = day.category
                ? CATEGORY_LABEL[day.category]
                : "this";
            if (
                !confirm(
                    `${item.name} is a ${CATEGORY_LABEL[item.category]} exercise, not typical for a ${dayName} day. Add it anyway?`,
                )
            )
                return;
        }
        start(() => addExerciseToDay(day.id, item.id));
        setQuery("");
    }

    const matches = catalog.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()),
    );
    const accepted = matches
        .filter(c => dayAcceptsExercise(day.category, c.category))
        .slice(0, 40);
    const offCategory = matches
        .filter(c => !dayAcceptsExercise(day.category, c.category))
        .slice(0, 12);

    const inputCls =
        "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-center text-sm outline-none focus:border-text-muted";
    const stepBtn =
        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm leading-none disabled:opacity-30";

    return (
        <div className='flex flex-col gap-5'>
            {/* party progress */}
            {day.partyId && members.length > 1 && (
                <details className='sticky top-14 z-10 rounded-xl border border-border bg-bg/95 backdrop-blur'>
                    <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium'>
                        <span>Party progress</span>
                        <span className='text-xs text-text-muted'>
                            {members.length} members ▾
                        </span>
                    </summary>
                    <div className='flex flex-col gap-2 border-t border-border p-3'>
                        {members.map(m => {
                            const t = memberDayTotals(m.user_id);
                            return (
                                <div
                                    key={m.user_id}
                                    className='flex items-center justify-between text-sm'>
                                    <span className='flex items-center gap-2'>
                                        <span
                                            className='inline-block h-2.5 w-2.5 rounded-full'
                                            style={{ background: m.color }}
                                        />
                                        {m.display_name || "Member"}
                                        {m.user_id === currentUserId && (
                                            <span className='text-text-muted'>
                                                {" "}
                                                (you)
                                            </span>
                                        )}
                                    </span>
                                    <span className='text-xs text-text-muted'>
                                        {t.exercisesLogged}/
                                        {day.exercises.length} done · vol{" "}
                                        <span className='text-text'>
                                            {t.volume || "—"}
                                        </span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </details>
            )}

            {/* category */}
            <div className='flex flex-wrap gap-1.5'>
                {DAY_CATEGORY_CHOICES.filter(c => c !== "rest").map(c => (
                    <button
                        key={c}
                        onClick={() => start(() => setDayCategory(day.id, c))}
                        className={`rounded-md border px-2.5 py-1 text-xs ${
                            day.category === c
                                ? CATEGORY_STYLE[c]
                                : "border-border text-text-muted hover:border-text-muted"
                        }`}>
                        {CATEGORY_LABEL[c]}
                    </button>
                ))}
            </div>

            <PlateCalculator />

            {/* exercises */}
            <ul className='flex flex-col gap-4'>
                {day.exercises.map((ex, idx) => {
                    const mine = myStats(ex);
                    const others = members.filter(
                        m => m.user_id !== currentUserId,
                    );
                    const isOpen = expanded[ex.id];
                    const mismatched = !dayAcceptsExercise(
                        day.category,
                        ex.exercise.category,
                    );
                    const addedByMe = ex.addedBy === currentUserId;
                    const adder = ex.addedBy
                        ? memberById.get(ex.addedBy)
                        : undefined;
                    const suggested = suggestedSets(
                        (goal as Goal) ?? null,
                        experience,
                        isCompound(ex.exercise),
                    );
                    const rows = rowsFor(ex);
                    return (
                        <li
                            key={ex.id}
                            className='rounded-xl border border-border p-3'>
                            <div className='flex items-start justify-between gap-2'>
                                <button
                                    onClick={() =>
                                        setExpanded(p => ({
                                            ...p,
                                            [ex.id]: !p[ex.id],
                                        }))
                                    }
                                    className='flex-1 text-left'>
                                    <div className='flex items-center gap-2 font-medium'>
                                        {ex.exercise.name}
                                        <span className='text-xs text-text-muted'>
                                            {isOpen ? "▴" : "▾"}
                                        </span>
                                    </div>
                                    <div className='text-xs text-text-muted'>
                                        {muscleList(ex.exercise.primary_muscles)}
                                    </div>
                                    {mismatched && (
                                        <div className='mt-1 text-xs text-amber-600 dark:text-amber-400'>
                                            {
                                                CATEGORY_LABEL[
                                                    ex.exercise.category
                                                ]
                                            }{" "}
                                            exercise on a{" "}
                                            {day.category
                                                ? CATEGORY_LABEL[day.category]
                                                : ""}{" "}
                                            day
                                        </div>
                                    )}
                                </button>
                                <div className='flex shrink-0 gap-1'>
                                    <button
                                        aria-label='Move up'
                                        onClick={() =>
                                            start(() =>
                                                reorderDayExercise(
                                                    ex.id,
                                                    day.id,
                                                    -1,
                                                ),
                                            )
                                        }
                                        disabled={idx === 0}
                                        className={stepBtn}>
                                        ↑
                                    </button>
                                    <button
                                        aria-label='Move down'
                                        onClick={() =>
                                            start(() =>
                                                reorderDayExercise(
                                                    ex.id,
                                                    day.id,
                                                    1,
                                                ),
                                            )
                                        }
                                        disabled={
                                            idx === day.exercises.length - 1
                                        }
                                        className={stepBtn}>
                                        ↓
                                    </button>
                                    {(canManageAll || addedByMe) && (
                                        <button
                                            aria-label='Remove exercise'
                                            onClick={() =>
                                                start(() =>
                                                    removeDayExercise(
                                                        ex.id,
                                                        day.id,
                                                    ),
                                                )
                                            }
                                            className={`${stepBtn} text-text-muted hover:border-rose-400 hover:text-rose-400`}>
                                            <TrashIcon />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isOpen && (
                                <div className='mt-3 rounded-lg bg-surface p-3'>
                                    <ExerciseDetailBody ex={ex.exercise} />
                                </div>
                            )}

                            {/* targets */}
                            <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs'>
                                <div className='flex items-center gap-1.5'>
                                    <span className='text-text-muted'>
                                        Sets
                                    </span>
                                    <button
                                        className={stepBtn}
                                        disabled={ex.targetSets <= 1}
                                        onClick={() =>
                                            setTarget(ex.id, {
                                                sets: ex.targetSets - 1,
                                            })
                                        }>
                                        −
                                    </button>
                                    <span className='w-4 text-center text-sm'>
                                        {ex.targetSets}
                                    </span>
                                    <button
                                        className={stepBtn}
                                        onClick={() =>
                                            setTarget(ex.id, {
                                                sets: ex.targetSets + 1,
                                            })
                                        }>
                                        +
                                    </button>
                                    {ex.targetSets < suggested && (
                                        <button
                                            onClick={() =>
                                                setTarget(ex.id, {
                                                    sets: suggested,
                                                })
                                            }
                                            className='ml-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-text-muted hover:text-text'>
                                            suggested {suggested}
                                        </button>
                                    )}
                                </div>
                                <div className='flex items-center gap-1.5'>
                                    <span className='text-text-muted'>
                                        Reps
                                    </span>
                                    <input
                                        inputMode='numeric'
                                        defaultValue={ex.targetRepMin ?? ""}
                                        onBlur={e =>
                                            setTarget(ex.id, {
                                                repMin: e.target.value
                                                    ? Number(e.target.value)
                                                    : undefined,
                                            })
                                        }
                                        className='w-10 rounded-md border border-border bg-surface px-1 py-1 text-center'
                                    />
                                    <span className='text-text-muted'>–</span>
                                    <input
                                        inputMode='numeric'
                                        defaultValue={ex.targetRepMax ?? ""}
                                        onBlur={e =>
                                            setTarget(ex.id, {
                                                repMax: e.target.value
                                                    ? Number(e.target.value)
                                                    : undefined,
                                            })
                                        }
                                        className='w-10 rounded-md border border-border bg-surface px-1 py-1 text-center'
                                    />
                                </div>
                                <div className='flex items-center gap-1.5'>
                                    <span className='text-text-muted'>
                                        Current weight
                                    </span>
                                    <input
                                        key={`w-${ex.id}-${ex.targetWeight ?? ""}`}
                                        inputMode='decimal'
                                        defaultValue={ex.targetWeight ?? ""}
                                        onBlur={e =>
                                            setTarget(ex.id, {
                                                weight: e.target.value
                                                    ? Number(e.target.value)
                                                    : null,
                                            })
                                        }
                                        className='w-14 rounded-md border border-border bg-surface px-1 py-1 text-center'
                                    />
                                </div>
                            </div>

                            {/* set log grid */}
                            <div className='mt-3 flex flex-col gap-1.5'>
                                <div className='grid grid-cols-[1.5rem_1fr_1fr] items-center gap-2 text-[11px] uppercase text-text-muted'>
                                    <span>Set</span>
                                    <span className='text-center'>Weight</span>
                                    <span className='text-center'>Reps</span>
                                </div>
                                {Array.from(
                                    { length: rows },
                                    (_, i) => i + 1,
                                ).map(s => {
                                    const c = cell(ex.id, s);
                                    return (
                                        <div
                                            key={s}
                                            className='grid grid-cols-[1.5rem_1fr_1fr] items-center gap-2'>
                                            <span className='text-sm text-text-muted'>
                                                {s}
                                            </span>
                                            <input
                                                inputMode='decimal'
                                                className={inputCls}
                                                placeholder={
                                                    s === 1 &&
                                                    ex.targetWeight != null
                                                        ? String(ex.targetWeight)
                                                        : ""
                                                }
                                                value={c.weight}
                                                onChange={e =>
                                                    update(
                                                        ex.id,
                                                        s,
                                                        "weight",
                                                        e.target.value,
                                                    )
                                                }
                                                onBlur={() => persist(ex.id, s)}
                                            />
                                            <input
                                                inputMode='numeric'
                                                className={inputCls}
                                                value={c.reps}
                                                onChange={e =>
                                                    update(
                                                        ex.id,
                                                        s,
                                                        "reps",
                                                        e.target.value,
                                                    )
                                                }
                                                onBlur={() => persist(ex.id, s)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted'>
                                <span>
                                    Your top set{" "}
                                    <span className='text-text'>
                                        {mine.top || "—"}
                                    </span>
                                </span>
                                <span>
                                    Your volume{" "}
                                    <span className='text-text'>
                                        {mine.volume || "—"}
                                    </span>
                                </span>
                            </div>

                            {/* notes */}
                            <textarea
                                key={`note-${ex.id}`}
                                defaultValue={myNote(ex.id)}
                                placeholder='Notes — how it felt, what to change next time…'
                                rows={2}
                                onBlur={e =>
                                    start(() =>
                                        saveExerciseNote({
                                            pdeId: ex.id,
                                            dayId: day.id,
                                            note: e.target.value,
                                        }),
                                    )
                                }
                                className='mt-2 w-full resize-y rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-text-muted'
                            />
                            {otherNotes(ex.id).map(n => {
                                const who = memberById.get(n.user_id);
                                return (
                                    <div
                                        key={n.user_id}
                                        className='mt-1 flex gap-1.5 text-xs text-text-muted'>
                                        <span
                                            className='mt-1 inline-block h-2 w-2 shrink-0 rounded-full'
                                            style={{
                                                background:
                                                    who?.color ??
                                                    "var(--text-muted)",
                                            }}
                                        />
                                        <span>
                                            <span className='text-text'>
                                                {who?.display_name || "Member"}:
                                            </span>{" "}
                                            {n.note}
                                        </span>
                                    </div>
                                );
                            })}

                            {day.partyId && (
                                <div className='mt-1 flex items-center gap-1.5 text-xs text-text-muted'>
                                    <span
                                        className='inline-block h-2 w-2 shrink-0 rounded-full'
                                        style={{
                                            background:
                                                adder?.color ??
                                                "var(--text-muted)",
                                        }}
                                    />
                                    Added by{" "}
                                    <span className='text-text'>
                                        {addedByMe
                                            ? "you"
                                            : (adder?.display_name ?? "someone")}
                                    </span>
                                </div>
                            )}

                            {day.partyId &&
                                (() => {
                                    const logged = others
                                        .map(m => ({
                                            m,
                                            o: otherStats(ex.id, m.user_id),
                                        }))
                                        .filter(
                                            ({ o }) =>
                                                o.top > 0 || o.volume > 0,
                                        );
                                    if (logged.length === 0) return null;
                                    return (
                                        <div className='mt-2 border-t border-border pt-2 text-xs text-text-muted'>
                                            <div className='mb-1 uppercase tracking-wide text-[10px]'>
                                                Party — sets logged on this
                                                exercise
                                            </div>
                                            {logged.map(({ m, o }) => (
                                                <div
                                                    key={m.user_id}
                                                    className='flex items-center gap-2'>
                                                    <span
                                                        className='inline-block h-2 w-2 rounded-full'
                                                        style={{
                                                            background: m.color,
                                                        }}
                                                    />
                                                    <span className='text-text'>
                                                        {m.display_name ||
                                                            "Member"}
                                                    </span>
                                                    <span>
                                                        top {o.top || "—"}
                                                    </span>
                                                    <span>
                                                        vol {o.volume || "—"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                        </li>
                    );
                })}
            </ul>

            {/* add exercise */}
            {showAdd ? (
                <div className='rounded-xl border border-border p-3'>
                    <div className='flex items-center justify-between'>
                        <span className='text-sm font-medium'>
                            Add{" "}
                            {day.category ? CATEGORY_LABEL[day.category] : ""}{" "}
                            exercise
                        </span>
                        <button
                            onClick={() => setShowAdd(false)}
                            className='text-xs text-text-muted hover:text-text'>
                            Done
                        </button>
                    </div>
                    <p className='mt-1 text-xs text-text-muted'>
                        Added exercises go to the bottom — use ↑/↓ on each to
                        reorder.
                    </p>
                    <input
                        autoFocus
                        placeholder='Search…'
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className='mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted'
                    />
                    <ul className='mt-2 max-h-72 overflow-y-auto'>
                        {accepted.map(c => (
                            <li key={c.id}>
                                <button
                                    onClick={() => tryAdd(c)}
                                    className='flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2'>
                                    <span>{c.name}</span>
                                    <span className='text-xs text-text-muted'>
                                        {muscleList(c.primary_muscles)}
                                    </span>
                                </button>
                            </li>
                        ))}
                        {accepted.length === 0 && (
                            <li className='px-2 py-3 text-sm text-text-muted'>
                                No{" "}
                                {day.category
                                    ? CATEGORY_LABEL[day.category]
                                    : ""}{" "}
                                matches.
                            </li>
                        )}

                        {offCategory.length > 0 && (
                            <>
                                <li className='px-2 pb-1 pt-3 text-[11px] uppercase text-text-muted'>
                                    Other categories
                                </li>
                                {offCategory.map(c => (
                                    <li key={c.id}>
                                        <button
                                            onClick={() => tryAdd(c)}
                                            className='flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-text-muted hover:bg-surface-2'>
                                            <span>{c.name}</span>
                                            <span className='text-xs'>
                                                {CATEGORY_LABEL[c.category]}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </>
                        )}
                    </ul>
                </div>
            ) : (
                <button
                    onClick={() => setShowAdd(true)}
                    className='rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface'>
                    + Add exercise
                </button>
            )}

            {pending && (
                <span className='fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-surface-2 px-3 py-1 text-xs text-text-muted'>
                    Saving…
                </span>
            )}
        </div>
    );
}
