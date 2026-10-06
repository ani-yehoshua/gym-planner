"use client";

import { useState, useTransition } from "react";
import { saveProgram } from "@/app/actions";
import { TrashIcon } from "@/components/icons";
import { announceSave } from "@/components/save-pill";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  muscleList,
} from "@/lib/labels";
import {
  clampDuration,
  programTotalDays,
  type DurationUnit,
} from "@/lib/programs";
import { DEFAULT_SETS } from "@/lib/targets";
import type { Measurement } from "@/lib/units";
import type { Enums } from "@/lib/supabase/database.types";

type Cat = Enums<"muscle_category">;

export type BuilderExercise = {
  id: string;
  name: string;
  category: Cat;
  primary_muscles: string[];
  time_based: boolean;
  measurement: Measurement;
  default_sets: number | null;
  default_rep_min: number | null;
  default_rep_max: number | null;
};

/** A saved program, as the builder is handed it when editing. */
export type InitialProgram = {
  id: string;
  name: string;
  description: string;
  durationUnit: DurationUnit;
  durationCount: number;
  days: {
    name: string;
    isRest: boolean;
    exercises: {
      exercise: BuilderExercise;
      sets: number | null;
      repMin: number | null;
      repMax: number | null;
    }[];
  }[];
};

type DraftExercise = {
  key: string;
  exercise: BuilderExercise;
  sets: number | null;
  repMin: number | null;
  repMax: number | null;
};
type DraftDay = {
  key: string;
  name: string;
  isRest: boolean;
  exercises: DraftExercise[];
};

const inp =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted";
const stepBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm leading-none disabled:opacity-30";

// React keys for the draft days/exercises; never rendered, so a module counter
// is enough (and keeps ref access out of render)
let keyCounter = 0;
const nextKey = () => `k${keyCounter++}`;

function toNum(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  return digits === "" ? null : Number(digits);
}

/** Build a program: name it, set how long it runs (days or weeks), and add the
 *  days it's made of — training days (exercises, sets, rep ranges) and rest
 *  days. Loading the program repeats that list on consecutive dates until the
 *  duration is filled. Nothing is saved until the button at the bottom. */
export function ProgramBuilder({
  initial,
  catalog,
}: {
  initial?: InitialProgram;
  catalog: BuilderExercise[];
}) {
  const fromInitial = (): DraftDay[] =>
    (initial?.days ?? []).map((d) => ({
      key: nextKey(),
      name: d.name,
      isRest: d.isRest,
      exercises: d.exercises.map((e) => ({ key: nextKey(), ...e })),
    }));

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [unit, setUnit] = useState<DurationUnit>(initial?.durationUnit ?? "weeks");
  const [count, setCount] = useState(String(initial?.durationCount ?? 4));
  const [days, setDays] = useState<DraftDay[]>(fromInitial);
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const patchDay = (key: string, patch: Partial<DraftDay>) =>
    setDays((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const patchExercise = (
    dayKey: string,
    exKey: string,
    patch: Partial<DraftExercise>,
  ) =>
    setDays((ds) =>
      ds.map((d) =>
        d.key !== dayKey
          ? d
          : {
              ...d,
              exercises: d.exercises.map((e) =>
                e.key === exKey ? { ...e, ...patch } : e,
              ),
            },
      ),
    );
  const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const copy = [...arr];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  };

  function addDay(kind: string) {
    if (kind !== "training" && kind !== "rest") return;
    const rest = kind === "rest";
    setDays((ds) => [
      ...ds,
      {
        key: nextKey(),
        // training days start unnamed (placeholder prompts for one); the "Day N"
        // number is added on the calendar from the day's place in the program
        name: rest ? "Rest" : "",
        isRest: rest,
        exercises: [],
      },
    ]);
    setError(null);
  }

  function addExercise(dayKey: string, ex: BuilderExercise) {
    setDays((ds) =>
      ds.map((d) =>
        d.key !== dayKey
          ? d
          : {
              ...d,
              exercises: [
                ...d.exercises,
                { key: nextKey(), exercise: ex, sets: null, repMin: null, repMax: null },
              ],
            },
      ),
    );
    setQuery("");
  }

  // how the cycle fills the duration
  const n = clampDuration(unit, Number(count));
  const total = programTotalDays(unit, n);
  const sessions = Array.from({ length: total }, (_, i) => days[i % days.length]).filter(
    (d) => d && !d.isRest,
  ).length;

  function submit() {
    if (!name.trim()) return setError("Give the program a name.");
    if (!days.some((d) => !d.isRest && d.exercises.length > 0))
      return setError("Add at least one training day with an exercise.");
    setError(null);
    announceSave("saving");
    start(async () => {
      try {
        await saveProgram({
          id: initial?.id,
          name,
          description,
          durationUnit: unit,
          durationCount: n,
          days: days.map((d) => ({
            name: d.name,
            isRest: d.isRest,
            exercises: d.exercises.map((e) => ({
              exerciseId: e.exercise.id,
              sets: e.sets,
              repMin: e.repMin,
              repMax: e.repMax,
            })),
          })),
        });
        announceSave("saved");
        if (!initial?.id) {
          // a new program starts the next one from a clean slate
          setName("");
          setDescription("");
          setDays([]);
        }
      } catch {
        announceSave("error");
        setError("Couldn't save the program. Try again.");
      }
    });
  }

  // catalog grouped by muscle group for the picker
  function groups(taken: Set<string>) {
    const m = new Map<Cat, BuilderExercise[]>();
    for (const c of catalog) {
      if (taken.has(c.id)) continue;
      if (!c.name.toLowerCase().includes(query.toLowerCase())) continue;
      const arr = m.get(c.category) ?? [];
      arr.push(c);
      m.set(c.category, arr);
    }
    return [...CATEGORY_ORDER]
      .filter((c) => m.has(c))
      .sort((a, b) => CATEGORY_LABEL[a].localeCompare(CATEGORY_LABEL[b]))
      .map((c) => ({ category: c, items: m.get(c)! }));
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Program name — e.g. Push / Pull / Legs"
        className={inp}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="What it is, who it’s for…"
        className={inp}
      />

      {/* duration */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-muted">Runs for</span>
        <input
          value={count}
          onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
          onBlur={() => setCount(String(clampDuration(unit, Number(count))))}
          inputMode="numeric"
          aria-label="Program length"
          className="w-16 rounded-md border border-border bg-surface px-1 py-1.5 text-center"
        />
        <div className="flex rounded-md border border-border p-0.5 text-xs">
          {(["days", "weeks"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                setUnit(u);
                setCount(String(clampDuration(u, Number(count))));
              }}
              className={`rounded px-2.5 py-1 font-medium capitalize ${
                unit === u ? "bg-text text-bg" : "text-text-muted"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* days */}
      <div className="flex flex-col gap-3">
        {days.length === 0 && (
          <p className="text-xs text-text-muted">
            No days yet. Add training days and rest days below — the list repeats
            until the program&apos;s length is filled.
          </p>
        )}

        {days.map((d, di) => {
          const taken = new Set(d.exercises.map((e) => e.exercise.id));
          const open = pickerDay === d.key;
          return (
            <div key={d.key} className="rounded-xl border border-border">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span className="shrink-0 text-xs text-text-muted">
                  {di + 1}
                </span>
                <input
                  value={d.name}
                  onChange={(e) => patchDay(d.key, { name: e.target.value })}
                  aria-label="Day name"
                  placeholder="Name — e.g. Push"
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium outline-none hover:border-border focus:border-text-muted"
                />
                {d.isRest && (
                  <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-text-muted">
                    Rest
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Move day up"
                  disabled={di === 0}
                  onClick={() => setDays((ds) => move(ds, di, -1))}
                  className={stepBtn}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move day down"
                  disabled={di === days.length - 1}
                  onClick={() => setDays((ds) => move(ds, di, 1))}
                  className={stepBtn}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove day"
                  onClick={() => setDays((ds) => ds.filter((x) => x.key !== d.key))}
                  className={`${stepBtn} text-text-muted hover:border-rose-400 hover:text-rose-400`}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>

              {d.isRest ? (
                <p className="px-3 py-2.5 text-xs text-text-muted">
                  Rest day — nothing is planned on the calendar.
                </p>
              ) : (
                <div className="flex flex-col gap-3 p-3">
                  <ul className="flex flex-col gap-3">
                    {d.exercises.map((e, ei) => {
                      const ex = e.exercise;
                      const effectiveSets = e.sets ?? ex.default_sets ?? DEFAULT_SETS;
                      return (
                        <li
                          key={e.key}
                          className="rounded-xl border border-border p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium">{ex.name}</div>
                              <div className="text-xs text-text-muted">
                                {muscleList(ex.primary_muscles)}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                aria-label="Move up"
                                disabled={ei === 0}
                                onClick={() =>
                                  patchDay(d.key, {
                                    exercises: move(d.exercises, ei, -1),
                                  })
                                }
                                className={stepBtn}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                aria-label="Move down"
                                disabled={ei === d.exercises.length - 1}
                                onClick={() =>
                                  patchDay(d.key, {
                                    exercises: move(d.exercises, ei, 1),
                                  })
                                }
                                className={stepBtn}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                aria-label="Remove exercise"
                                onClick={() =>
                                  patchDay(d.key, {
                                    exercises: d.exercises.filter(
                                      (x) => x.key !== e.key,
                                    ),
                                  })
                                }
                                className={`${stepBtn} text-text-muted hover:border-rose-400 hover:text-rose-400`}
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-text-muted">Sets</span>
                              <button
                                type="button"
                                className={stepBtn}
                                disabled={effectiveSets <= 1}
                                onClick={() =>
                                  patchExercise(d.key, e.key, {
                                    sets: effectiveSets - 1,
                                  })
                                }
                              >
                                −
                              </button>
                              <span
                                className={`w-4 text-center text-sm ${
                                  e.sets == null ? "text-text-muted" : ""
                                }`}
                                title={
                                  e.sets == null
                                    ? "Not set — uses the exercise's own default"
                                    : undefined
                                }
                              >
                                {effectiveSets}
                              </span>
                              <button
                                type="button"
                                className={stepBtn}
                                onClick={() =>
                                  patchExercise(d.key, e.key, {
                                    sets: effectiveSets + 1,
                                  })
                                }
                              >
                                +
                              </button>
                              {e.sets != null && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    patchExercise(d.key, e.key, { sets: null })
                                  }
                                  className="text-[11px] text-text-muted hover:text-text"
                                >
                                  clear
                                </button>
                              )}
                            </div>

                            {ex.measurement !== "distance" && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-text-muted">
                                  {ex.time_based ? "Sec" : "Reps"}
                                </span>
                                <input
                                  inputMode="numeric"
                                  value={e.repMin ?? ""}
                                  placeholder={ex.default_rep_min?.toString() ?? ""}
                                  onChange={(ev) =>
                                    patchExercise(d.key, e.key, {
                                      repMin: toNum(ev.target.value),
                                    })
                                  }
                                  className="w-10 rounded-md border border-border bg-surface px-1 py-1 text-center"
                                />
                                <span className="text-text-muted">–</span>
                                <input
                                  inputMode="numeric"
                                  value={e.repMax ?? ""}
                                  placeholder={ex.default_rep_max?.toString() ?? ""}
                                  onChange={(ev) =>
                                    patchExercise(d.key, e.key, {
                                      repMax: toNum(ev.target.value),
                                    })
                                  }
                                  className="w-10 rounded-md border border-border bg-surface px-1 py-1 text-center"
                                />
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {open ? (
                    <div className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Add exercise</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPickerDay(null);
                            setQuery("");
                          }}
                          className="text-xs text-text-muted hover:text-text"
                        >
                          Done
                        </button>
                      </div>
                      <input
                        placeholder="Search…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className={`${inp} mt-2 w-full`}
                      />
                      <div className="mt-2 max-h-96 overflow-y-auto">
                        {groups(taken).map((g) => (
                          <details
                            key={g.category}
                            open={query.length > 0}
                            className="mb-1.5 rounded-lg border border-border"
                          >
                            <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-sm font-medium">
                              {CATEGORY_LABEL[g.category]}
                              <span className="text-xs font-normal text-text-muted">
                                {g.items.length} ▾
                              </span>
                            </summary>
                            <ul className="border-t border-border p-1">
                              {g.items.map((c) => (
                                <li key={c.id}>
                                  <button
                                    type="button"
                                    onClick={() => addExercise(d.key, c)}
                                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                                  >
                                    <span>{c.name}</span>
                                    <span className="text-xs text-text-muted">
                                      {muscleList(c.primary_muscles)}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ))}
                        {groups(taken).length === 0 && (
                          <p className="px-2 py-3 text-sm text-text-muted">
                            No matches.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPickerDay(d.key);
                        setQuery("");
                      }}
                      className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface"
                    >
                      + Add exercise
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <select
          value=""
          onChange={(e) => addDay(e.target.value)}
          aria-label="Add day"
          className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-muted"
        >
          <option value="" disabled>
            Add day…
          </option>
          <option value="training">Training day</option>
          <option value="rest">Rest day</option>
        </select>
      </div>

      {days.length > 0 && (
        <p className="text-xs text-text-muted">
          {days.length} {days.length === 1 ? "day" : "days"} repeating over{" "}
          {total} calendar {total === 1 ? "day" : "days"} →{" "}
          <span className="text-text">{sessions}</span> training{" "}
          {sessions === 1 ? "session" : "sessions"}.
        </p>
      )}

      {error && <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
      >
        {pending ? "Saving…" : initial?.id ? "Save program" : "Create program"}
      </button>
    </div>
  );
}
