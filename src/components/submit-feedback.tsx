"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function SubmitFeedback({
  defaultEmail = "",
  className,
  label = "Feedback",
}: {
  defaultEmail?: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
    setNote(null);
  }

  async function submit() {
    if (!message.trim()) {
      setNote({ ok: false, text: "Add a short description first." });
      return;
    }
    setBusy(true);
    setNote(null);
    const fd = new FormData();
    fd.append("email", email);
    fd.append("message", message);
    files.forEach((f) => fd.append("files", f));
    try {
      const res = await fetch("/api/report-issue", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success) {
        setNote({ ok: true, text: "Thanks — sent. We'll take a look." });
        setMessage("");
        setFiles([]);
        setTimeout(close, 1800);
      } else {
        setNote({ ok: false, text: json.error || "Something went wrong." });
      }
    } catch {
      setNote({ ok: false, text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEmail(defaultEmail);
          setOpen(true);
        }}
        className={className ?? "text-xs text-text-muted hover:text-text"}
      >
        {label}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
            onClick={close}
          >
            <div
              className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-bg p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Send feedback</h2>
                <button
                  onClick={close}
                  className="text-xs text-text-muted hover:text-text"
                >
                  Close
                </button>
              </div>

              <label className="flex flex-col gap-1 text-xs text-text-muted">
                Your email
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className={field}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-text-muted">
                What&rsquo;s up?
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="A bug, an idea, something that felt off…"
                  className={`${field} resize-y`}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-text-muted">
                Screenshot (optional)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    setFiles(Array.from(e.target.files ?? []).slice(0, 3))
                  }
                  className="text-xs text-text-muted file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-2 file:py-1 file:text-xs"
                />
              </label>
              {files.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-[11px] text-text-muted">
                  {files.map((f) => (
                    <li key={f.name} className="truncate">
                      {f.name}
                    </li>
                  ))}
                </ul>
              )}

              {note && (
                <p
                  className={`text-xs ${
                    note.ok ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {note.text}
                </p>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="mt-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
