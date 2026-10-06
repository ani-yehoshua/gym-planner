"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { createDay } from "@/app/actions";
import { CATEGORY_LABEL, DAY_PLAN_CHOICES } from "@/lib/labels";
import { parseProgramChoice, programChoiceValue } from "@/lib/programs";

/** Calendar: picking a session type from the dropdown creates the day and
 *  drops you straight into it — no separate "Add" button. Picking a program
 *  instead opens it with this day pre-filled as the start date, since a
 *  program fills many days, not just this one. */
export function AddSessionForm({
  date,
  programs,
}: {
  date: string;
  programs: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  return (
    <form ref={formRef} action={createDay}>
      <input type="hidden" name="date" value={date} />
      <select
        name="category"
        defaultValue=""
        onChange={(e) => {
          const value = e.currentTarget.value;
          if (!value) return;
          const programId = parseProgramChoice(value);
          if (programId) {
            router.push(`/programs/${programId}?start=${date}`);
            return;
          }
          formRef.current?.requestSubmit();
        }}
        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-muted"
      >
        <option value="" disabled>
          Plan session…
        </option>
        <optgroup label="Build your own">
          {DAY_PLAN_CHOICES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </optgroup>
        {programs.length > 0 && (
          <optgroup label="Start a program">
            {programs.map((p) => (
              <option key={p.id} value={programChoiceValue(p.id)}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </form>
  );
}
