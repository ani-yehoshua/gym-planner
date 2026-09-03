"use client";

import { useTransition } from "react";
import { deleteDay, deleteParty, leaveParty } from "@/app/actions";
import { ExitIcon, TrashIcon } from "@/components/icons";

const cls =
  "flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-300";

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
      className={cls}
    >
      <TrashIcon className="h-3.5 w-3.5" />
      {pending ? "Deleting…" : "Delete day"}
    </button>
  );
}

export function DeletePartyButton({ partyId }: { partyId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            "Delete this party for everyone? All shared days and members are removed.",
          )
        ) {
          start(() => deleteParty(partyId));
        }
      }}
      className={cls}
    >
      <TrashIcon className="h-3.5 w-3.5" />
      {pending ? "Deleting…" : "Delete party"}
    </button>
  );
}

export function LeavePartyButton({ partyId }: { partyId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Leave this party?")) start(() => leaveParty(partyId));
      }}
      className={cls}
    >
      <ExitIcon className="h-3.5 w-3.5" />
      {pending ? "Leaving…" : "Leave party"}
    </button>
  );
}
