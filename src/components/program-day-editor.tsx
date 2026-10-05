"use client";

import { useState, useTransition } from "react";
import {
  addProgramExercise,
  removeProgramExercise,
  reorderProgramExercise,
  setProgramCategory,
  updateProgramExercise,
} from "@/app/actions";
import { TrashIcon } from "@/components/icons";
import { announceSave } from "@/components/save-pill";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  CATEGORY_STYLE,
  DAY_PLAN_CHOICES,
  dayAcceptsExercise,
  dayType,
  muscleList,
} from "@/lib/labels";
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

export type BuilderRow = {
  id: string;
  sets: number | null;
  repMin: number | null;
  repMax: number | null;
  exercise: BuilderExercise;
};

const stepBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm leading-none disabled:opacity-30";

/** Build a program the way you plan a session on the Calendar: pick the type,
 *  add exercises from the catalog, set sets and a rep range on each, reorder or
 *  remove them. Everything saves as you go. */
export function ProgramDayEditor({
  programId,
  category,
  rows,
  catalog,
}: {
  programId: string;
  category: Cat | null;
  rows: BuilderRow[];
  catalog: BuilderExercise[];
}) {
  const [, start] = useTransition();
  const [showAdd, setShowAdd] = useState(rows.length === 0);
  const [query, setQuery] = useState("");

  function run(fn: () => Promise<unknown>) {
    announceSave("saving");
    start(async () => {
      try {
        await fn();
        announceSave("saved");
      } catch {
        announceSave("error");
      }
    });
  }

  function tryAdd(item: BuilderExercise) {
    if (!dayAcceptsExercise(category, item.category)) {
      const dayName = category ? CATEGORY_LABEL[category] : "this";
      if (
        !confirm(
          `${item.name} is a ${CATEGORY_LABEL[item.category]} exercise, not typical for a ${dayName} day. Add it anyway?`,
        )
      )
        return;
    }
    run(() => addProgramExercise(programId, item.id));
    setQuery("");
  }

  const taken = new Set(rows.map((r) => r.exercise.id));
  const matches = catalog.filter(
    (c) => !taken.has(c.id) && c.name.toLowerCase().includes(query.toLowerCase()),
  );

  function groupByCategory(items: BuilderExercise[]) {
    const m = new Map<Cat, BuilderExercise[]>();
    for (const c of items) {
      const arr = m.get(c.category) ?? [];
      arr.push(c);
      m.set(c.category, arr);
    }
    return [...CATEGORY_ORDER]
      .filter((c) => m.has(c))
      .sort((a, b) => CATEGORY_LABEL[a].localeCompare(CATEGORY_LABEL[b]))
      .map((c) => ({ category: c, items: m.get(c)! }));
  }
  const acceptedGroups = groupByCategory(
    matches.filter((c) => dayAcceptsExercise(category, c.category)),
  );
  const otherGroups = groupByCategory(
    matches.filter((c) => !dayAcceptsExercise(category, c.category)),
  );

  const picker = (items: BuilderExercise[], muted: boolean) =>
    items.map((c) => (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => tryAdd(c)}
          className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2 ${
            muted ? "text-text-muted" : ""
          }`}
        >
          <span>{c.name}</span>
          <span className="text-xs text-text-muted">
            {muscleList(c.primary_muscles)}
          </span>
        </button>
      </li>
    ));

  return (
    <div className="flex flex-col gap-3">
      {/* session type */}
      <div className="flex flex-wrap gap-1.5">
        {DAY_PLAN_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => run(() => setProgramCategory(programId, c))}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              dayType(category) === c
                ? CATEGORY_STYLE[c]
                : "border-border text-text-muted hover:border-text-muted"
            }`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {/* exercises */}
      <ul className="flex flex-col gap-3">
        {rows.map((r, idx) => {
          const ex = r.exercise;
          const unit = ex.time_based ? "Sec" : "Reps";
          const effectiveSets = r.sets ?? ex.default_sets ?? DEFAULT_SETS;
          return (
            <li key={r.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{ex.name}</div>
                  <div className="text-xs text-text-muted">
                    {muscleList(ex.primary_muscles)}
                  </div>
                  {!dayAcceptsExercise(category, ex.category) && (
                    <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {CATEGORY_LABEL[ex.category]} exercise on a{" "}
                      {CATEGORY_LABEL[dayType(category)]} day
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={idx === 0}
                    onClick={() =>
                      run(() => reorderProgramExercise(r.id, programId, -1))
                    }
                    className={stepBtn}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={idx === rows.length - 1}
                    onClick={() =>
                      run(() => reorderProgramExercise(r.id, programId, 1))
                    }
                    className={stepBtn}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Remove exercise"
                    onClick={() =>
                      run(() => removeProgramExercise(r.id, programId))
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
                      run(() =>
                        updateProgramExercise({
                          id: r.id,
                          programId,
                          sets: effectiveSets - 1,
                        }),
                      )
                    }
                  >
                    −
                  </button>
                  <span
                    className={`w-4 text-center text-sm ${
                      r.sets == null ? "text-text-muted" : ""
                    }`}
                    title={
                      r.sets == null
                        ? "Not set — members get the exercise's own default"
                        : undefined
                    }
                  >
                    {effectiveSets}
                  </span>
                  <button
                    type="button"
                    className={stepBtn}
                    onClick={() =>
                      run(() =>
                        updateProgramExercise({
                          id: r.id,
                          programId,
                          sets: effectiveSets + 1,
                        }),
                      )
                    }
                  >
                    +
                  </button>
                  {r.sets != null && (
                    <button
                      type="button"
                      onClick={() =>
                        run(() =>
                          updateProgramExercise({
                            id: r.id,
                            programId,
                            sets: null,
                          }),
                        )
                      }
                      className="text-[11px] text-text-muted hover:text-text"
                    >
                      clear
                    </button>
                  )}
                </div>

                {ex.measurement !== "distance" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted">{unit}</span>
                    <input
                      key={`rmin-${r.id}-${r.repMin ?? ""}`}
                      inputMode="numeric"
                      defaultValue={r.repMin ?? ""}
                      placeholder={ex.default_rep_min?.toString() ?? ""}
                      onBlur={(e) =>
                        run(() =>
                          updateProgramExercise({
                            id: r.id,
                            programId,
                            repMin: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }),
                        )
                      }
                      className="w-10 rounded-md border border-border bg-surface px-1 py-1 text-center"
                    />
                    <span className="text-text-muted">–</span>
                    <input
                      key={`rmax-${r.id}-${r.repMax ?? ""}`}
                      inputMode="numeric"
                      defaultValue={r.repMax ?? ""}
                      placeholder={ex.default_rep_max?.toString() ?? ""}
                      onBlur={(e) =>
                        run(() =>
                          updateProgramExercise({
                            id: r.id,
                            programId,
                            repMax: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }),
                        )
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

      {rows.length === 0 && (
        <p className="text-xs text-text-muted">
          No exercises yet — add some below.
        </p>
      )}

      {/* add exercise */}
      {showAdd ? (
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Add {CATEGORY_LABEL[dayType(category)]} exercise
            </span>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-xs text-text-muted hover:text-text"
            >
              Done
            </button>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Added exercises go to the bottom — use ↑/↓ on each to reorder.
          </p>
          <input
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted"
          />
          <div className="mt-2 max-h-96 overflow-y-auto">
            {acceptedGroups.map((g) => (
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
                  {picker(g.items, false)}
                </ul>
              </details>
            ))}
            {acceptedGroups.length === 0 && (
              <p className="px-2 py-3 text-sm text-text-muted">
                No {CATEGORY_LABEL[dayType(category)]} matches.
              </p>
            )}

            {otherGroups.length > 0 && (
              <>
                <p className="px-1 pb-1 pt-3 text-[11px] uppercase text-text-muted">
                  Other categories
                </p>
                {otherGroups.map((g) => (
                  <details
                    key={g.category}
                    open={query.length > 0}
                    className="mb-1.5 rounded-lg border border-border"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-sm font-medium text-text-muted">
                      {CATEGORY_LABEL[g.category]}
                      <span className="text-xs font-normal">
                        {g.items.length} ▾
                      </span>
                    </summary>
                    <ul className="border-t border-border p-1">
                      {picker(g.items, true)}
                    </ul>
                  </details>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface"
        >
          + Add exercise
        </button>
      )}
    </div>
  );
}
