"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function EmailField({ current }: { current: string }) {
  const [email, setEmail] = useState(current);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = email.trim().toLowerCase() !== current.toLowerCase();

  async function save() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/account` },
    );
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({
      ok: true,
      text: `Check ${email.trim()} for a link to confirm the change.`,
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Email</span>
      <div className="flex items-center gap-2">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setMsg(null);
          }}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty || !email.trim()}
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {msg && (
        <p
          className={`text-xs ${
            msg.ok ? "text-text-muted" : "text-rose-500"
          }`}
        >
          {msg.text}
        </p>
      )}
      <p className="text-xs text-text-muted">
        Used to sign in. Changing it needs confirmation from the new address.
      </p>
    </div>
  );
}
