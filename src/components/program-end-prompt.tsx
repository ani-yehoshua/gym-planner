import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { startProgram, stopProgram } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { formatShort } from "@/lib/date";

/** Shown once the program you were running has ended: repeat it, pick a new
 *  one, or dismiss. Renders nothing while a program is still in progress. */
export async function ProgramEndPrompt({
  userId,
  todayISO,
}: {
  userId: string;
  todayISO: string;
}) {
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("user_programs")
    .select("program_id, end_date, programs(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!run || run.end_date >= todayISO) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
      <div>
        <div className="text-sm font-semibold">
          You finished {run.programs?.name ?? "your program"} 🎉
        </div>
        <p className="mt-0.5 text-xs text-text-muted">
          It ended {formatShort(run.end_date)}. Run it again, or start something
          new?
        </p>
      </div>

      <form action={startProgram} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="program_id" value={run.program_id} />
        <input
          type="date"
          name="start_date"
          required
          defaultValue={todayISO}
          aria-label="Repeat starting on"
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
        />
        <SubmitButton
          pendingText="Loading…"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          Repeat program
        </SubmitButton>
      </form>

      <div className="flex items-center gap-4 text-sm">
        <Link href="/programs" className="font-medium text-accent hover:underline">
          Choose a new program
        </Link>
        <form action={stopProgram}>
          <SubmitButton
            pendingText="…"
            className="text-xs text-text-muted hover:text-text disabled:opacity-50"
          >
            Not now
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
