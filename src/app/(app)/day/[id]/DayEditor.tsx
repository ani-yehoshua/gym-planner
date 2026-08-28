"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addExerciseToDay,
  deleteDay,
  logSet,
  removeDayExercise,
  setDayCategory,
} from "@/app/actions";
import { CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_STYLE, MUSCLE_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

type Cat = Enums<"muscle_category">;
type CatalogItem = {
  id: string;
  name: string;
  category: Cat;
  primary_muscles: Enums<"muscle_group">[];
};
type DayEx = {
  id: string;
  targetSets: number;
  targetRepMin: number | null;
  targetRepMax: number | null;
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

export default function DayEditor({
  day,
  currentUserId,
  members,
  logs,
  catalog,
}: {
  day: { id: string; category: Cat | null; partyId: string | null; exercises: DayEx[] };
  currentUserId: string;
  members: { user_id: string; display_name: string | null }[];
  logs: LogRow[];
  catalog: CatalogItem[];
}) {
  const [pending, start] = useTransition();

  // local edits keyed by `${pdeId}:${setNo}` for the current user
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
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(day.exercises.length === 0);

  const nameById = new Map(members.map((m) => [m.user_id, m.display_name || "Member"]));

  function cell(pdeId: string, setNo: number) {
    return values.get(`${pdeId}:${setNo}`) ?? { weight: "", reps: "" };
  }

  function update(pdeId: string, setNo: number, field: "weight" | "reps", raw: string) {
    const key = `${pdeId}:${setNo}`;
    const nextCell = { ...cell(pdeId, setNo), [field]: raw };
    setValues((prev) => new Map(prev).set(key, nextCell));
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

  function rowsFor(ex: DayEx) {
    const base = Math.max(ex.targetSets, 1);
    return base + (extra[ex.id] ?? 0);
  }

  function myStats(ex: DayEx) {
    let volume = 0;
    let top = 0;
    for (let s = 1; s <= rowsFor(ex) + 2; s++) {
      const c = values.get(`${ex.id}:${s}`);
      if (!c) continue;
      const w = Number(c.weight);
      const r = Number(c.reps);
      if (c.weight !== "" && c.reps !== "") volume += w * r;
      if (c.weight !== "" && c.reps !== "" && w > top) top = w;
    }
    return { volume, top };
  }

  function otherStats(pdeId: string, userId: string) {
    let volume = 0;
    let top = 0;
    for (const l of logs) {
      if (l.planned_day_exercise_id !== pdeId || l.user_id !== userId) continue;
      if (l.weight != null && l.reps != null) {
        volume += l.weight * l.reps;
        if (l.weight > top) top = l.weight;
      }
    }
    return { volume, top };
  }

  const filtered = catalog
    .filter((c) => (day.category ? c.category === day.category : true))
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40);

  const inputCls =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-center text-sm outline-none focus:border-zinc-500";

  return (
    <div className="flex flex-col gap-5">
      {/* category */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_ORDER.filter((c) => c !== "rest").map((c) => (
          <button
            key={c}
            onClick={() => start(() => setDayCategory(day.id, c))}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              day.category === c
                ? CATEGORY_STYLE[c]
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {/* exercises */}
      <ul className="flex flex-col gap-4">
        {day.exercises.map((ex) => {
          const mine = myStats(ex);
          const others = members.filter((m) => m.user_id !== currentUserId);
          return (
            <li key={ex.id} className="rounded-xl border border-zinc-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{ex.exercise.name}</div>
                  <div className="text-xs text-zinc-500">
                    {ex.targetSets} ×{" "}
                    {ex.targetRepMin && ex.targetRepMax
                      ? `${ex.targetRepMin}–${ex.targetRepMax}`
                      : "—"}
                    {ex.exercise.primary_muscles.length > 0 && (
                      <> · {ex.exercise.primary_muscles.map((m) => MUSCLE_LABEL[m]).join(", ")}</>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => start(() => removeDayExercise(ex.id, day.id))}
                  className="text-xs text-zinc-500 hover:text-rose-400"
                >
                  Remove
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                <div className="grid grid-cols-[1.5rem_1fr_1fr] items-center gap-2 text-[11px] uppercase text-zinc-500">
                  <span>Set</span>
                  <span className="text-center">Weight</span>
                  <span className="text-center">Reps</span>
                </div>
                {Array.from({ length: rowsFor(ex) }, (_, i) => i + 1).map((s) => {
                  const c = cell(ex.id, s);
                  return (
                    <div key={s} className="grid grid-cols-[1.5rem_1fr_1fr] items-center gap-2">
                      <span className="text-sm text-zinc-500">{s}</span>
                      <input
                        inputMode="decimal"
                        className={inputCls}
                        value={c.weight}
                        onChange={(e) => update(ex.id, s, "weight", e.target.value)}
                        onBlur={() => persist(ex.id, s)}
                      />
                      <input
                        inputMode="numeric"
                        className={inputCls}
                        value={c.reps}
                        onChange={(e) => update(ex.id, s, "reps", e.target.value)}
                        onBlur={() => persist(ex.id, s)}
                      />
                    </div>
                  );
                })}
                <button
                  onClick={() =>
                    setExtra((p) => ({ ...p, [ex.id]: (p[ex.id] ?? 0) + 1 }))
                  }
                  className="mt-1 self-start text-xs text-zinc-500 hover:text-zinc-300"
                >
                  + set
                </button>
              </div>

              <div className="mt-2 flex gap-4 text-xs text-zinc-400">
                <span>
                  Top set <span className="text-zinc-200">{mine.top || "—"}</span>
                </span>
                <span>
                  Volume <span className="text-zinc-200">{mine.volume || "—"}</span>
                </span>
              </div>

              {day.partyId && others.length > 0 && (
                <div className="mt-2 border-t border-zinc-800 pt-2 text-xs text-zinc-500">
                  {others.map((m) => {
                    const o = otherStats(ex.id, m.user_id);
                    return (
                      <div key={m.user_id} className="flex gap-3">
                        <span className="text-zinc-400">{nameById.get(m.user_id)}</span>
                        <span>top {o.top || "—"}</span>
                        <span>vol {o.volume || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* add exercise */}
      {showAdd ? (
        <div className="rounded-xl border border-zinc-800 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Add {day.category ? CATEGORY_LABEL[day.category] : ""} exercise
            </span>
            <button
              onClick={() => setShowAdd(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Done
            </button>
          </div>
          <input
            autoFocus
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <ul className="mt-2 max-h-72 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    start(() => addExerciseToDay(day.id, c.id));
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-800"
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-zinc-500">
                    {c.primary_muscles.map((m) => MUSCLE_LABEL[m]).join(", ")}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-sm text-zinc-500">No matches.</li>
            )}
          </ul>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
        >
          + Add exercise
        </button>
      )}

      <button
        onClick={() => {
          if (confirm("Delete this day?")) start(() => deleteDay(day.id));
        }}
        className="self-start text-xs text-zinc-600 hover:text-rose-400"
      >
        Delete day
      </button>

      {pending && (
        <span className="fixed bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
          Saving…
        </span>
      )}
    </div>
  );
}
