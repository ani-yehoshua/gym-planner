import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLong } from "@/lib/date";
import { DeleteDayButton } from "@/components/delete-day-button";
import DayEditor from "./DayEditor";

// stable per-member accent colors
const MEMBER_COLORS = [
  "#f43f5e", "#3b82f6", "#22c55e", "#f59e0b",
  "#a855f7", "#06b6d4", "#ec4899", "#84cc16",
];

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
      "id, date, category, label, owner_user, party_id, parties(name), planned_day_exercises(id, sort, target_sets, target_rep_min, target_rep_max, added_by, exercises(id, name, category, primary_muscles, secondary_muscles, howto_text, media_url))",
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

  const { data: notes } = pdeIds.length
    ? await supabase
        .from("day_exercise_notes")
        .select("planned_day_exercise_id, user_id, note")
        .in("planned_day_exercise_id", pdeIds)
    : { data: [] };

  let members: { user_id: string; display_name: string | null; color: string }[] = [];
  let isPartyOwner = false;
  if (day.party_id) {
    const { data: m } = await supabase
      .from("party_members")
      .select("user_id, role, joined_at, profiles(display_name)")
      .eq("party_id", day.party_id)
      .order("joined_at");
    members = (m ?? []).map((x, i) => ({
      user_id: x.user_id,
      display_name: x.profiles?.display_name ?? null,
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    }));
    isPartyOwner = (m ?? []).some(
      (x) => x.user_id === user.id && x.role === "owner",
    );
  }
  // personal days: you own everything; party days: only the owner manages all
  const canManageAll = !day.party_id || isPartyOwner;

  const { data: constants } = await supabase
    .from("user_constants")
    .select("primary_goal, experience")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: catalog } = await supabase
    .from("exercises")
    .select("id, name, category, primary_muscles, secondary_muscles, howto_text, media_url")
    .is("archived_at", null)
    .order("name");

  const backHref = day.party_id ? `/parties/${day.party_id}` : "/";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href={backHref} className="text-sm text-text-muted hover:text-text">
          ← {day.party_id ? "Party" : "Calendar"}
        </Link>
        {canManageAll && <DeleteDayButton dayId={day.id} />}
      </div>
      <div>
        <h1 className="text-lg font-semibold">{formatLong(day.date)}</h1>
        {day.party_id && (
          <p className="text-sm text-text-muted">
            Shared with{" "}
            <Link href={`/parties/${day.party_id}`} className="underline">
              {day.parties?.name ?? "party"}
            </Link>
            {" · "}your sets log to your own profile
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
              targetSets: p.target_sets ?? 2,
              targetRepMin: p.target_rep_min,
              targetRepMax: p.target_rep_max,
              addedBy: p.added_by,
              exercise: p.exercises,
            })),
        }}
        currentUserId={user.id}
        canManageAll={canManageAll}
        members={members}
        logs={logs ?? []}
        notes={notes ?? []}
        catalog={catalog ?? []}
        goal={constants?.primary_goal ?? null}
        experience={constants?.experience ?? null}
      />
    </div>
  );
}
