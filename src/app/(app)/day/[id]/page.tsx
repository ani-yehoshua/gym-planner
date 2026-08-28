import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLong } from "@/lib/date";
import DayEditor from "./DayEditor";

export default async function DayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: day } = await supabase
    .from("planned_days")
    .select(
      "id, date, category, label, owner_user, party_id, parties(name), planned_day_exercises(id, sort, target_sets, target_rep_min, target_rep_max, exercises(id, name, category, primary_muscles))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!day) notFound();

  const pdeIds = day.planned_day_exercises.map((p) => p.id);
  const { data: logs } = pdeIds.length
    ? await supabase
        .from("set_logs")
        .select("planned_day_exercise_id, user_id, set_no, weight, reps, volume")
        .in("planned_day_exercise_id", pdeIds)
    : { data: [] };

  let members: { user_id: string; display_name: string | null }[] = [];
  if (day.party_id) {
    const { data: m } = await supabase
      .from("party_members")
      .select("user_id, profiles(display_name)")
      .eq("party_id", day.party_id);
    members = (m ?? []).map((x) => ({
      user_id: x.user_id,
      display_name: x.profiles?.display_name ?? null,
    }));
  }

  const { data: catalog } = await supabase
    .from("exercises")
    .select("id, name, category, primary_muscles")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Calendar
      </Link>
      <div>
        <h1 className="text-lg font-semibold">{formatLong(day.date)}</h1>
        {day.party_id && (
          <p className="text-sm text-zinc-400">
            Shared with{" "}
            <Link href={`/parties/${day.party_id}`} className="underline">
              {day.parties?.name ?? "party"}
            </Link>
          </p>
        )}
      </div>

      <DayEditor
        day={{
          id: day.id,
          category: day.category,
          partyId: day.party_id,
          exercises: [...day.planned_day_exercises]
            .sort((a, b) => a.sort - b.sort)
            .map((p) => ({
              id: p.id,
              targetSets: p.target_sets ?? 3,
              targetRepMin: p.target_rep_min,
              targetRepMax: p.target_rep_max,
              exercise: p.exercises,
            })),
        }}
        currentUserId={user.id}
        members={members}
        logs={logs ?? []}
        catalog={catalog ?? []}
      />
    </div>
  );
}
