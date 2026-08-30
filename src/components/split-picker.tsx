"use client";

import { useState } from "react";
import { applyCustomSplit } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { CATEGORY_LABEL, DAY_CATEGORY_CHOICES } from "@/lib/labels";
import { dowShort, parseISODate, toISODate, today } from "@/lib/date";
import type { Enums } from "@/lib/supabase/database.types";

type Cat = Enums<"muscle_category">;
type Slot = Cat | "rest";

export type SplitTemplate = {
  id: string;
  name: string;
  description: string | null;
  slots: Slot[]; // length 7
};

const BLANK: Slot[] = ["rest", "rest", "rest", "rest", "rest", "rest", "rest"];

export function SplitPicker({ templates }: { templates: SplitTemplate[] }) {
  const [sourceId, setSourceId] = useState("");
  const [slots, setSlots] = useState<Slot[]>(BLANK);
  const [fromDate, setFromDate] = useState(today());
  const [weeks, setWeeks] = useState(8);

  function choosePreset(id: string) {
    setSourceId(id);
    const t = templates.find((x) => x.id === id);
    setSlots(t ? [...t.slots] : BLANK);
  }

  function setSlot(i: number, v: Slot) {
    setSlots((s) => s.map((x, idx) => (idx === i ? v : x)));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j > 6) return;
    setSlots((s) => {
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const trainingDays = slots.filter((s) => s !== "rest").length;

  return (
    <form action={applyCustomSplit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Start from a preset</label>
        <select
          value={sourceId}
          onChange={(e) => choosePreset(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">Build my own</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {sourceId && (
          <p className="text-xs text-text-muted">
            {templates.find((t) => t.id === sourceId)?.description}
          </p>
        )}
      </div>

      <input type="hidden" name="source_template_id" value={sourceId} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Week ({trainingDays} training {trainingDays === 1 ? "day" : "days"})
        </span>
        {slots.map((slot, i) => {
          const dow = dowShort(toISODate(offsetDate(fromDate || today(), i)));
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-text-muted">
                {dow} · {i + 1}
              </span>
              <select
                name={`slot_${i}`}
                value={slot}
                onChange={(e) => setSlot(i, e.target.value as Slot)}
                className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
              >
                <option value="rest">Rest</option>
                {DAY_CATEGORY_CHOICES.filter((c) => c !== "rest").map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === 6}
                className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          );
        })}
        <p className="text-xs text-text-muted">
          Day 1 is your start date; the pattern repeats each week.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-muted">Start date</label>
          <input
            type="date"
            name="from_date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-muted">Weeks</label>
          <input
            type="number"
            name="weeks"
            min={1}
            max={16}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>

      <SubmitButton
        pendingText="Applying…"
        disabled={trainingDays === 0}
        className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-40"
      >
        Apply to calendar
      </SubmitButton>
    </form>
  );
}

function offsetDate(iso: string, days: number): Date {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return d;
}
