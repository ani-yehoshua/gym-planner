import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgramCard } from "@/components/program-card";
import { ProgramEditor } from "@/components/program-editor";
import { SavePillHost } from "@/components/save-pill";
import { isAdmin } from "@/lib/admin";

const EXERCISE_FIELDS =
  "id, name, category, primary_muscles, time_based, measurement, default_sets, default_rep_min, default_rep_max";

export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: programs }, admin] = await Promise.all([
    supabase
      .from("programs")
      .select(
        `id, name, description, category, program_exercises(id, sort, sets, rep_min, rep_max, exercises(${EXERCISE_FIELDS}))`,
      )
      .order("name"),
    isAdmin(supabase),
  ]);
  const all = programs ?? [];

  // the exercise picker in the builder — only admins need the catalog
  const { data: catalog } = admin
    ? await supabase
        .from("exercises")
        .select(EXERCISE_FIELDS)
        .is("archived_at", null)
        .order("name")
    : { data: [] };

  return (
    <div className="flex flex-col gap-4">
      <SavePillHost />
      <h1 className="text-lg font-semibold">Programs</h1>
      <p className="-mt-2 text-xs text-text-muted">
        Ready-made sessions. When you plan a day on the Calendar, pick a program
        to get its exercises, sets and rep ranges filled in.
      </p>

      {admin && <ProgramEditor programs={all} catalog={catalog ?? []} />}

      {all.length === 0 ? (
        <p className="text-sm text-text-muted">
          No programs yet.
          {admin && " Use “Manage programs” above to build one."}
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          {all.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </section>
      )}
    </div>
  );
}
