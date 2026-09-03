"use client";

import { useEffect, useState } from "react";
import { updateTimezone } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function TimezoneField({ current }: { current: string }) {
  const [device, setDevice] = useState<string | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDevice(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      /* ignore */
    }
  }, []);

  const mismatch = device && device !== current;

  return (
    <form action={updateTimezone} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Timezone</span>
      <div className="flex items-center gap-2">
        <input
          name="timezone"
          defaultValue={current}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <SubmitButton
          pendingText="Saving…"
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50"
        >
          Save
        </SubmitButton>
      </div>
      {mismatch && (
        <button
          type="submit"
          name="timezone"
          value={device}
          className="self-start text-xs text-accent hover:underline"
        >
          Use this device&apos;s timezone ({device})
        </button>
      )}
      <p className="text-xs text-text-muted">
        Controls which calendar day is highlighted as &ldquo;today.&rdquo;
      </p>
    </form>
  );
}
