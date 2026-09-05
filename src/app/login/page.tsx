"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN = 30;

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    params.get("error") ? "That link didn't work — try again." : "",
  );
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const supabase = createClient();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("code");
    setCooldown(RESEND_COOLDOWN);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  }

  async function submitCode(code: string) {
    if (code.length !== 6) return;
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError("That code didn't match. Check it or request a new one.");
      setDigits(Array(6).fill(""));
      inputRefs.current[0]?.focus();
      return;
    }
    // Hard navigation so the server picks up the fresh session cookie
    // cleanly — router.replace/refresh can race the cookie write here.
    window.location.assign(next);
  }

  function handleDigitChange(i: number, value: string) {
    const v = value.replace(/\D/g, "");
    if (!v) {
      const next = [...digits];
      next[i] = "";
      setDigits(next);
      return;
    }
    // paste-to-fill: a multi-digit value landing in one box spreads forward
    if (v.length > 1) {
      const next = [...digits];
      for (let j = 0; j < v.length && i + j < 6; j++) next[i + j] = v[j];
      setDigits(next);
      const lastIdx = Math.min(i + v.length, 5);
      inputRefs.current[lastIdx]?.focus();
      if (next.every((d) => d)) submitCode(next.join(""));
      return;
    }
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (i < 5) inputRefs.current[i + 1]?.focus();
    if (next.every((d) => d)) submitCode(next.join(""));
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  const label =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-muted";
  const input =
    "w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-base outline-none focus:border-text-muted";
  const primaryBtn =
    "w-full rounded-full bg-primary px-4 py-4 text-base font-semibold text-primary-fg disabled:opacity-50";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-10 px-6 py-8">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold leading-none text-accent">
          Gym<span className="text-text">Planner</span>
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.08em] text-text-muted">
          Plan your training, log every set
        </p>
      </div>

      <div className="w-full">
        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col">
            <label className={label}>Email</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${input} mb-4`}
            />
            <button type="submit" disabled={busy || !email} className={primaryBtn}>
              {busy ? "Sending…" : "Send me a code"}
            </button>
            <p className="mt-3 text-center text-xs text-text-muted">
              New here? The same code creates your account.
            </p>
          </form>
        ) : (
          <div className="flex flex-col items-center">
            <p className="mb-4 text-center text-sm text-text-muted">
              Enter the 6-digit code sent to{" "}
              <span className="text-text">{email}</span>
            </p>
            <div className="mb-5 flex justify-center gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="h-[52px] w-11 rounded-xl border border-border bg-surface text-center text-xl outline-none focus:border-text-muted"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => sendCode()}
              disabled={cooldown > 0 || busy}
              className="w-full rounded-xl border border-border px-3 py-3 text-sm text-text-muted disabled:opacity-50 enabled:hover:text-text"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setDigits(Array(6).fill(""));
                setError("");
              }}
              className="mt-3 text-xs text-text-muted hover:text-text"
            >
              ← Use a different email
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-rose-400">{error}</p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
