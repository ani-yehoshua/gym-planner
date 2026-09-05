import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLong } from "@/lib/date";
import { isCompound, recommendedReps, type Goal } from "@/lib/targets";
import { DeleteDayButton } from "@/components/danger-button";
import { ChevronLeftIcon } from "@/components/icons";
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
      "id, date, category, label, owner_user, party_id, parties(name), planned_day_exercises(id, sort, target_sets, target_rep_min, target_rep_max, target_weight, added_by, exercises(id, name, category, primary_muscles, secondary_muscles, howto_text, media_url, time_based))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!day) notFound();

  const pdeRows = day.planned_day_exercises;
  type PdeRow = (typeof pdeRows)[number];
  const pdeIds = pdeRows.map((p) => p.id);
  const exIds = [...new Set(pdeRows.map((p) => p.exercises.id))];

  const [
    { data: logs },
    { data: notes },
    { data: myTargets },
    { data: myPrefs },
    { data: m },
    { data: constants },
    { data: catalog },
    { data: prevLogs },
  ] = await Promise.all([
    pdeIds.length
      ? supabase
          .from("set_logs")
          .select("planned_day_exercise_id, user_id, set_no, weight, reps, volume")
          .in("planned_day_exercise_id", pdeIds)
      : Promise.resolve({ data: [] }),
    pdeIds.length
      ? supabase
          .from("day_exercise_notes")
          .select("planned_day_exercise_id, user_id, note")
          .in("planned_day_exercise_id", pdeIds)
      : Promise.resolve({ data: [] }),
    // my own per-exercise targets for this day + my saved catalog defaults
    pdeIds.length
      ? supabase
          .from("day_exercise_user_targets")
          .select("planned_day_exercise_id, target_sets, target_rep_min, target_rep_max, target_weight")
          .eq("user_id", user.id)
          .in("planned_day_exercise_id", pdeIds)
      : Promise.resolve({ data: [] }),
    exIds.length
      ? supabase
          .from("user_exercise_prefs")
          .select("exercise_id, default_sets, default_rep_min, default_rep_max, default_weight")
          .eq("user_id", user.id)
          .in("exercise_id", exIds)
      : Promise.resolve({ data: [] }),
    day.party_id
      ? supabase
          .from("party_members")
          .select("user_id, role, joined_at, profiles(display_name)")
          .eq("party_id", day.party_id)
          .order("joined_at")
      : Promise.resolve({ data: [] }),
    supabase
      .from("user_constants")
      .select("primary_goal, experience")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("exercises")
      .select("id, name, category, primary_muscles, secondary_muscles, howto_text, media_url, time_based")
      .is("archived_at", null)
      .order("name"),
    // my own prior sets for these exercises — for the "last time" line on each card
    exIds.length
      ? supabase
          .from("set_logs")
          .select(
            "set_no, weight, reps, planned_day_exercises!inner(exercise_id, planned_days!inner(id, date))",
          )
          .eq("user_id", user.id)
          .in("planned_day_exercises.exercise_id", exIds)
          .not("weight", "is", null)
          .not("reps", "is", null)
          .order("set_no")
      : Promise.resolve({ data: [] }),
  ]);

  const targetByPde = new Map(
    (myTargets ?? []).map((t) => [t.planned_day_exercise_id, t]),
  );
  const prefByExercise = new Map((myPrefs ?? []).map((p) => [p.exercise_id, p]));

  const members = (m ?? []).map((x, i) => ({
    user_id: x.user_id,
    display_name: x.profiles?.display_name ?? null,
    color: MEMBER_COLORS[i % MEMBER_COLORS.length],
  }));
  const isPartyOwner = (m ?? []).some(
    (x) => x.user_id === user.id && x.role === "owner",
  );
  // personal days: you own everything; party days: only the owner manages all
  const canManageAll = !day.party_id || isPartyOwner;

  const goal = (constants?.primary_goal as Goal) ?? null;

  // most recent prior session per exercise (this user), for the card summary
  type PrevRow = {
    set_no: number;
    weight: number | null;
    reps: number | null;
    planned_day_exercises: {
      exercise_id: string;
      planned_days: { id: string; date: string } | null;
    } | null;
  };
  const prevByExercise: Record<
    string,
    { date: string; sets: { weight: number; reps: number }[] }
  > = {};
  {
    const rowsByEx: Record<
      string,
      { date: string; set_no: number; weight: number; reps: number }[]
    > = {};
    for (const row of (prevLogs ?? []) as PrevRow[]) {
      const pde = row.planned_day_exercises;
      const pd = pde?.planned_days;
      if (!pde || !pd || pd.id === id || pd.date >= day.date) continue;
      (rowsByEx[pde.exercise_id] ??= []).push({
        date: pd.date,
        set_no: row.set_no,
        weight: row.weight!,
        reps: row.reps!,
      });
    }
    for (const [exId, rows] of Object.entries(rowsByEx)) {
      const maxDate = rows.reduce((a, r) => (r.date > a ? r.date : a), "");
      prevByExercise[exId] = {
        date: maxDate,
        sets: rows
          .filter((r) => r.date === maxDate)
          .sort((a, b) => a.set_no - b.set_no)
          .map((r) => ({ weight: r.weight, reps: r.reps })),
      };
    }
  }

  /** effective target for the current user. Sets/reps: my day edit -> my saved
   *  default -> the shared (global) seed -> goal recommendation. Weight is
   *  purely personal: my day edit -> my saved default -> nothing. */
  function effectiveTarget(p: PdeRow) {
    const t = targetByPde.get(p.id);
    const pref = prefByExercise.get(p.exercises.id);
    const [recMin, recMax] = recommendedReps(goal, isCompound(p.exercises));
    return {
      sets:
        t?.target_sets ?? pref?.default_sets ?? p.target_sets ?? 2,
      repMin:
        t?.target_rep_min ?? pref?.default_rep_min ?? p.target_rep_min ?? recMin,
      repMax:
        t?.target_rep_max ?? pref?.default_rep_max ?? p.target_rep_max ?? recMax,
      weight: t?.target_weight ?? pref?.default_weight ?? null,
    };
  }

  const backHref = day.party_id ? `/parties/${day.party_id}` : "/";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text"
        >
          <ChevronLeftIcon />
          {day.party_id ? "Party" : "Calendar"}
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
          date: day.date,
          category: day.category,
          partyId: day.party_id,
          exercises: [...day.planned_day_exercises]
            .sort((a, b) => a.sort - b.sort)
            .map((p) => {
              const e = effectiveTarget(p);
              return {
                id: p.id,
                targetSets: e.sets,
                targetRepMin: e.repMin,
                targetRepMax: e.repMax,
                targetWeight: e.weight,
                addedBy: p.added_by,
                exercise: { ...p.exercises, timeBased: p.exercises.time_based },
              };
            }),
        }}
        currentUserId={user.id}
        canManageAll={canManageAll}
        members={members}
        logs={logs ?? []}
        notes={notes ?? []}
        catalog={(catalog ?? []).map((c) => ({ ...c, timeBased: c.time_based }))}
        lastByExercise={prevByExercise}
        goal={goal}
        experience={constants?.experience ?? null}
      />
    </div>
  );
}
