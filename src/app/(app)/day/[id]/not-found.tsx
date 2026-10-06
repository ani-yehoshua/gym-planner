"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { clearActiveSession } from "@/lib/active-session";

/** A day that doesn't exist (deleted, a stopped program's day, or on another
 *  device). Also forgets it as the "Resume" session, so the nav doesn't keep
 *  sending you back here. */
export default function DayNotFound() {
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (id) clearActiveSession(id);
  }, [id]);

  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-lg font-semibold">That day isn&apos;t on your calendar</h1>
      <p className="text-sm text-text-muted">
        It may have been deleted, or removed when a program was stopped.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
      >
        Back to the Calendar
      </Link>
    </div>
  );
}
