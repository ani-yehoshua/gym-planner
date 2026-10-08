import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgramCard } from "@/components/program-card";
import { ProgramEditor } from "@/components/program-editor";
import { ProgramEndPrompt } from "@/components/program-end-prompt";
import { SavePillHost } from "@/components/save-pill";
import { StopProgramButton } from "@/components/stop-program-button";
import { isAdmin } from "@/lib/admin";
import { formatShort } from "@/lib/date";
import { getUserToday } from "@/lib/user-today";

const EXERCISE_FIELDS =
    "id, name, category, primary_muscles, time_based, measurement, default_sets, default_rep_min, default_rep_max, variant_group, variant_label";

export default async function ProgramsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const todayISO = await getUserToday();
    const [{ data: programs }, { data: run }, admin] = await Promise.all([
        supabase
            .from("programs")
            .select(
                `id, name, description, difficulty, duration_unit, duration_count, program_days(id, position, name, is_rest, program_exercises(id, sort, sets, rep_min, rep_max, set_reps, superset_group, exercises(${EXERCISE_FIELDS})))`,
            )
            .order("name"),
        supabase
            .from("user_programs")
            .select("program_id, start_date, end_date")
            .eq("user_id", user.id)
            .maybeSingle(),
        isAdmin(supabase),
    ]);
    const all = programs ?? [];
    const active =
        run && run.end_date >= todayISO
            ? all.find(p => p.id === run.program_id)
            : undefined;

    // the exercise picker in the builder — only admins need the catalog
    const { data: catalog } = admin
        ? await supabase
              .from("exercises")
              .select(EXERCISE_FIELDS)
              .is("archived_at", null)
              .order("name")
        : { data: [] };

    return (
        <div className='flex flex-col gap-4'>
            <SavePillHost />
            <h1 className='text-lg font-semibold'>Programs</h1>
            <p className='-mt-2 text-xs text-text-muted'>
                Ready-made plans. Pick one, choose a start date, and every
                training day is added to your calendar for you.
            </p>

            <ProgramEndPrompt
                userId={user.id}
                todayISO={todayISO}
            />

            {active && run && (
                <section className='flex items-start justify-between gap-3 rounded-xl border border-border p-4'>
                    <div>
                        <div className='text-xs text-text-muted'>
                            You&apos;re following
                        </div>
                        <Link
                            href={`/programs/${active.id}`}
                            className='font-semibold hover:underline'>
                            {active.name}
                        </Link>
                        <div className='text-xs text-text-muted'>
                            {formatShort(run.start_date)} –{" "}
                            {formatShort(run.end_date)}
                        </div>
                    </div>
                    <StopProgramButton label='Stop program' />
                </section>
            )}

            {admin && (
                <ProgramEditor
                    programs={
                        all as Parameters<typeof ProgramEditor>[0]["programs"]
                    }
                    catalog={catalog ?? []}
                />
            )}

            {all.length === 0 ? (
                <p className='text-sm text-text-muted'>
                    No programs yet.
                    {admin && " Use “Manage programs” above to build one."}
                </p>
            ) : (
                <section className='flex flex-col gap-2'>
                    {all.map(p => (
                        <ProgramCard
                            key={p.id}
                            program={p}
                        />
                    ))}
                </section>
            )}
        </div>
    );
}
