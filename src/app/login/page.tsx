"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    params.get("error") ? "error" : "idle",
  );

  const supabase = createClient();
  const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setStatus(error ? "error" : "sent");
  }

  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">GymPlanner</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Plan your training, log every set, lift with your crew.
        </p>
      </div>

      {status === "sent" ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          Check your email for a sign-in link.
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Email me a link"}
          </button>
          {status === "error" && (
            <p className="text-sm text-rose-400">
              Something went wrong. Try again.
            </p>
          )}
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-zinc-600">
        <span className="h-px flex-1 bg-zinc-800" />
        or
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <button
        onClick={google}
        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium hover:bg-zinc-900"
      >
        Continue with Google
      </button>
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
