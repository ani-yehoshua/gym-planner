"use client";

import { useRef } from "react";
import { createDay } from "@/app/actions";
import { CATEGORY_LABEL, DAY_PLAN_CHOICES } from "@/lib/labels";

/** Calendar: picking a session type from the dropdown creates the day and
 *  drops you straight into it — no separate "Add" button. */
export function AddSessionForm({ date }: { date: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={createDay}>
      <input type="hidden" name="date" value={date} />
      <select
        name="category"
        defaultValue=""
        onChange={(e) => {
          if (e.currentTarget.value) formRef.current?.requestSubmit();
        }}
        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-muted"
      >
        <option value="" disabled>
          Plan session…
        </option>
        {DAY_PLAN_CHOICES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
    </form>
  );
}
