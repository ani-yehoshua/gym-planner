"use client";

import { useState } from "react";
import Link from "next/link";
import { addDays, dayOfMonth, dowShort, formatRangeNumeric } from "@/lib/date";
import { CATEGORY_LABEL, CATEGORY_STYLE } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

export type HistoryDay = {
  id: string;
  date: string;
  category: Enums<"muscle_category"> | null;
  partyName: string | null;
  volume: number;
  exercisesDone: number;
  top: string | null;
};

export function HistoryList({
  weeks,
}: {
  weeks: { start: string; days: HistoryDay[] }[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const byId = new Map(weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
  const chosen = selected.map((id) => byId.get(id)!).filter(Boolean);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id].slice(-4),
    );
  }

  return (
    <>
      <div className="max-h-96 overflow-y-auto rounded-xl border border-border">
        {weeks.map((w, wi) => (
          <details
            key={w.start}
            open={wi === 0}
            className={wi > 0 ? "border-t border-border" : ""}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm">
              <span className="font-medium">
                {formatRangeNumeric(w.start, addDays(w.start, 6))}
              </span>
              <span className="text-xs text-text-muted">
                {w.days.length} day{w.days.length === 1 ? "" : "s"} ▾
              </span>
            </summary>
            <ul className="flex flex-col gap-1 border-t border-border p-2">
              {w.days.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(d.id)}
                    onChange={() => toggle(d.id)}
                    className="h-4 w-4 shrink-0 accent-[currentColor]"
                    aria-label="Compare this day"
                  />
                  <Link
                    href={`/day/${d.id}`}
                    className="flex flex-1 items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface"
                  >
                    <span className="w-9 shrink-0 text-center">
                      <span className="block text-[10px] uppercase text-text-muted">
                        {dowShort(d.date)}
                      </span>
                      <span className="block font-semibold leading-none">
                        {dayOfMonth(d.date)}
                      </span>
                    </span>
                    {d.category && (
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-xs ${CATEGORY_STYLE[d.category]}`}
                      >
                        {CATEGORY_LABEL[d.category]}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
                      {d.exercisesDone} ex
                      {d.top && <> · top {d.top}</>}
                      {d.partyName && <> · {d.partyName}</>}
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">
                      vol <span className="text-text">{d.volume}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      {chosen.length >= 2 && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Comparing {chosen.length} days</span>
            <button
              onClick={() => setSelected([])}
              className="text-xs text-text-muted hover:text-text"
            >
              Clear
            </button>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              <tr className="text-xs uppercase text-text-muted">
                <th className="py-1 pr-3 font-medium">Day</th>
                {chosen.map((d) => (
                  <th key={d.id} className="px-2 py-1 font-medium">
                    {d.date.slice(5)}
                  </th>
                ))}
              </tr>
              {[
                ["Category", (d: HistoryDay) => (d.category ? CATEGORY_LABEL[d.category] : "—")],
                ["Exercises", (d: HistoryDay) => String(d.exercisesDone)],
                ["Volume", (d: HistoryDay) => String(d.volume)],
                ["Top", (d: HistoryDay) => d.top ?? "—"],
              ].map(([label, get]) => (
                <tr key={label as string} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-text-muted">{label as string}</td>
                  {chosen.map((d) => (
                    <td key={d.id} className="px-2 py-1.5">
                      {(get as (d: HistoryDay) => string)(d)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
