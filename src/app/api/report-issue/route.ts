import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminRecipients } from "@/lib/admin";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per attachment
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const form = await req.formData();
  const email = String(form.get("email") || "").trim() || user?.email || "unknown";
  const message = String(form.get("message") || "").trim();
  if (!message) {
    return NextResponse.json(
      { success: false, error: "Message is required." },
      { status: 400 },
    );
  }

  const to = adminRecipients();
  const key = process.env.RESEND_API_KEY;
  if (to.length === 0 || !key) {
    // No mail configured — accept it so the UI doesn't error, but nothing sent.
    return NextResponse.json({ success: true, sent: false });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  let total = 0;
  const attachments: { filename: string; content: string }[] = [];
  for (const file of files) {
    if (file.size === 0 || file.size > MAX_FILE_BYTES) continue;
    total += file.size;
    if (total > MAX_TOTAL_BYTES) break;
    const buf = Buffer.from(await file.arrayBuffer());
    attachments.push({
      filename: file.name || "attachment",
      content: buf.toString("base64"),
    });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "GymPlanner <onboarding@resend.dev>",
        to,
        reply_to: email,
        subject: "GymPlanner feedback",
        text: `From: ${email}${user ? ` (user ${user.id})` : ""}\n\n${message}`,
        ...(attachments.length ? { attachments } : {}),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ success: true, sent: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not send. Try again." },
      { status: 502 },
    );
  }
}
