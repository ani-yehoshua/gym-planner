"use client";

import { useTransition } from "react";
import { deleteDay } from "@/app/actions";

export function DeleteDayButton({ dayId }: { dayId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this day and everything logged on it?")) {
          start(() => deleteDay(dayId));
        }
      }}
      className="text-sm text-text-muted hover:text-rose-400 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete day"}
    </button>
  );
}
