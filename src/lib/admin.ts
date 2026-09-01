import type { createClient } from "@/lib/supabase/server";

/** ADMIN_EMAILS is a comma-separated list; the first entry receives request emails. */
export function adminRecipient(): string | null {
  const first = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  return first || null;
}

/** Authoritative admin check — the DB `is_admin()` function (admins table or
 *  admin_emails list, which mirrors ADMIN_EMAILS). */
export async function isAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}

/** Fire-and-forget notification to the admin about a new exercise request.
 *  Uses Resend when RESEND_API_KEY is set; otherwise a no-op (request is still
 *  saved to the DB and shown to admins in-app). */
export async function notifyExerciseRequest(input: {
  name: string;
  note: string | null;
  fromEmail: string | null;
}) {
  const to = adminRecipient();
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "GymPlanner <onboarding@resend.dev>",
        to,
        subject: `Exercise request: ${input.name}`,
        text: [
          `New exercise request: ${input.name}`,
          input.note ? `\nNote: ${input.note}` : "",
          input.fromEmail ? `\nFrom: ${input.fromEmail}` : "",
        ].join(""),
      }),
    });
  } catch {
    /* email is best-effort; the DB row is the source of truth */
  }
}
