import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLong } from "@/lib/date";
import { PROGRAM_STYLE } from "@/lib/labels";
import { parseSetReps } from "@/lib/programs";
import { isCompound, recommendedReps, type Goal } from "@/lib/targets";
import { DeleteDayButton } from "@/components/danger-button";
import { ChevronLeftIcon } from "@/components/icons";
import { StopProgramButton } from "@/components/stop-program-button";
import { distanceUnitLabel, type Unit } from "@/lib/units";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { fetchPendingProposals } from "@/lib/party-proposals";
import {
    computeLastTimes,
    stampLastTime,
    type LastEntry,
} from "@/lib/last-time";
import { SlideProgramDay } from "@/components/slide-program-day";
import { getUserToday } from "@/lib/user-today";
import DayEditor from "./DayEditor";

// stable per-member accent colors
const MEMBER_COLORS = [
    "#f43f5e",
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#a855f7",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
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
            "id, date, category, label, owner_user, party_id, is_deload, program_id, program_day_number, program_run_id, parties(name), programs(name), planned_day_exercises(id, sort, target_sets, target_rep_min, target_rep_max, target_weight, target_distance, log_mode, added_by, from_program, program_set_reps, superset_group, exercises(id, name, category, primary_muscles, secondary_muscles, howto_text, media_url, time_based, weighted, measurement, default_distance, default_sets, default_rep_min, default_rep_max, variant_group, variant_label, grip, equipment))",
        )
        .eq("id", id)
        .maybeSingle();

    if (!day) notFound();

    // the Stop button only shows on days of the program you're currently following
    const { data: run } = day.program_id
        ? await supabase
              .from("user_programs")
              .select("program_id")
              .eq("user_id", user.id)
              .maybeSingle()
        : { data: null };
    const followingThisProgram = !!run && run.program_id === day.program_id;

    const pdeRows = day.planned_day_exercises;
    type PdeRow = (typeof pdeRows)[number];
    const pdeIds = pdeRows.map(p => p.id);
    const exIds = [...new Set(pdeRows.map(p => p.exercises.id))];
    // whose numbers to load: just mine, or the whole party on a party day
    const { data: partyRows } = day.party_id
        ? await supabase
              .from("party_members")
              .select("user_id")
              .eq("party_id", day.party_id)
        : { data: [] };
    const partyMemberIds = [
        ...new Set([user.id, ...(partyRows ?? []).map(r => r.user_id)]),
    ];

    const [
        { data: logs },
        { data: notes },
        { data: myTargets },
        { data: myPrefs },
        { data: m },
        { data: constants },
        { data: catalog },
        { data: lastSnapshots },
        { data: profile },
        { data: favoriteRows },
    ] = await Promise.all([
        pdeIds.length
            ? supabase
                  .from("set_logs")
                  .select(
                      "planned_day_exercise_id, user_id, set_no, weight, reps, distance, volume, drops",
                  )
                  .in("planned_day_exercise_id", pdeIds)
            : Promise.resolve({ data: [] }),
        pdeIds.length
            ? supabase
                  .from("day_exercise_notes")
                  .select("planned_day_exercise_id, user_id, note")
                  .in("planned_day_exercise_id", pdeIds)
            : Promise.resolve({ data: [] }),
        // per-exercise targets for this day + saved catalog defaults: mine, and
        // on a party day every member's (so one member can log for another)
        pdeIds.length
            ? supabase
                  .from("day_exercise_user_targets")
                  .select(
                      "planned_day_exercise_id, user_id, target_sets, target_rep_min, target_rep_max, target_weight, target_distance, is_one_rm",
                  )
                  .in("user_id", partyMemberIds)
                  .in("planned_day_exercise_id", pdeIds)
            : Promise.resolve({ data: [] }),
        exIds.length
            ? supabase
                  .from("user_exercise_prefs")
                  .select(
                      "exercise_id, user_id, default_sets, default_rep_min, default_rep_max, default_weight, default_distance, default_log_mode",
                  )
                  .in("user_id", partyMemberIds)
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
            .select("primary_goal, experience, focus_muscles")
            .eq("user_id", user.id)
            .maybeSingle(),
        supabase
            .from("exercises")
            .select(
                "id, name, category, primary_muscles, secondary_muscles, howto_text, media_url, time_based, weighted, measurement, default_distance, variant_group, variant_label, grip, equipment",
            )
            .is("archived_at", null)
            .order("name"),
        // the "Last" rows already stamped onto this day's exercises
        pdeIds.length
            ? supabase
                  .from("day_exercise_last")
                  .select("planned_day_exercise_id, entry")
                  .eq("user_id", user.id)
                  .in("planned_day_exercise_id", pdeIds)
            : Promise.resolve({ data: [] }),
        supabase
            .from("profiles")
            .select("units, distance_unit")
            .eq("id", user.id)
            .maybeSingle(),
        // my hearted exercises, for the heart on each card
        supabase
            .from("user_favorite_exercises")
            .select("exercise_id")
            .eq("user_id", user.id),
    ]);

    // keyed by member and exercise instance / exercise
    const targetByPde = new Map(
        (myTargets ?? []).map(t => [
            `${t.user_id}:${t.planned_day_exercise_id}`,
            t,
        ]),
    );
    const prefByExercise = new Map(
        (myPrefs ?? []).map(p => [`${p.user_id}:${p.exercise_id}`, p]),
    );

    const members = (m ?? []).map((x, i) => ({
        user_id: x.user_id,
        display_name: x.profiles?.display_name ?? null,
        color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    }));
    // personal days: you own everything; party days: any member is a co-owner
    // of the shared exercise list (matches the pde_write RLS policy) — but
    // deleting the day itself stays owner-only (pd_delete RLS), so that one
    // still checks role separately below
    const canManageAll =
        !day.party_id || (m ?? []).some(x => x.user_id === user.id);
    const isPartyOwner = (m ?? []).some(
        x => x.user_id === user.id && x.role === "owner",
    );
    const canDeleteDay = !day.party_id || isPartyOwner;

    const goal = (constants?.primary_goal as Goal) ?? null;

    // The "Last" row on each card. It's stamped with what the last time was when
    // you first logged the exercise on this day, and kept: looking back at a
    // day later shows the last time as it was then. An exercise with nothing
    // logged yet shows the live answer, and gets stamped once you log it.
    const prevByExercise: Record<string, LastEntry> = {};
    {
        const stampedByPde = new Map(
            (lastSnapshots ?? []).map(r => [r.planned_day_exercise_id, r]),
        );
        const open: string[] = [];
        for (const p of pdeRows) {
            const snap = stampedByPde.get(p.id);
            if (snap) {
                if (snap.entry && !prevByExercise[p.exercises.id])
                    prevByExercise[p.exercises.id] =
                        snap.entry as unknown as LastEntry;
            } else if (!open.includes(p.exercises.id)) {
                open.push(p.exercises.id);
            }
        }
        const live = await computeLastTimes(
            supabase,
            user.id,
            open.filter(exId => !prevByExercise[exId]),
            day.date,
        );
        for (const [exId, entry] of Object.entries(live))
            prevByExercise[exId] = entry;

        // days logged before stamping existed: stamp them on first view, from
        // the history before that day (the same answer they'd have shown then)
        const loggedPdes = new Set(
            (logs ?? [])
                .filter(l => l.user_id === user.id)
                .map(l => l.planned_day_exercise_id),
        );
        await Promise.all(
            pdeRows
                .filter(p => loggedPdes.has(p.id) && !stampedByPde.has(p.id))
                .map(p => stampLastTime(supabase, user.id, p.id)),
        );
    }

    /** effective target for the current user. Sets/reps: my day edit -> my saved
     *  default -> the shared (global) seed -> the exercise's own catalog
     *  default -> goal recommendation (last resort, only when nothing was ever
     *  set for this exercise). Weight is purely personal: my day edit -> my
     *  saved default -> nothing. */
    function effectiveTarget(p: PdeRow, userId: string = user!.id) {
        const t = targetByPde.get(`${userId}:${p.id}`);
        const pref = prefByExercise.get(`${userId}:${p.exercises.id}`);
        const [recMin, recMax] = recommendedReps(goal, isCompound(p.exercises));
        // a program's exercise carries the program's own sets and reps, which
        // beat the member's saved exercise defaults (those are for exercises
        // they add themselves); per-set ranges also fix the set count
        const fromProgram = p.from_program;
        const programSets = parseSetReps(p.program_set_reps).length;
        return {
            sets: fromProgram
                ? programSets ||
                  (t?.target_sets ??
                      p.target_sets ??
                      pref?.default_sets ??
                      p.exercises.default_sets ??
                      2)
                : (t?.target_sets ??
                  pref?.default_sets ??
                  p.target_sets ??
                  p.exercises.default_sets ??
                  2),
            repMin: fromProgram
                ? (t?.target_rep_min ??
                  p.target_rep_min ??
                  pref?.default_rep_min ??
                  p.exercises.default_rep_min ??
                  recMin)
                : (t?.target_rep_min ??
                  pref?.default_rep_min ??
                  p.target_rep_min ??
                  p.exercises.default_rep_min ??
                  recMin),
            repMax: fromProgram
                ? (t?.target_rep_max ??
                  p.target_rep_max ??
                  pref?.default_rep_max ??
                  p.exercises.default_rep_max ??
                  recMax)
                : (t?.target_rep_max ??
                  pref?.default_rep_max ??
                  p.target_rep_max ??
                  p.exercises.default_rep_max ??
                  recMax),
            weight: t?.target_weight ?? pref?.default_weight ?? null,
            distance:
                t?.target_distance ??
                pref?.default_distance ??
                p.target_distance ??
                p.exercises.default_distance ??
                null,
            logMode: (p.log_mode ?? pref?.default_log_mode ?? "time") as
                | "time"
                | "distance",
        };
    }

    // sets/reps changes other members made to this shared session
    const proposals = day.party_id
        ? await fetchPendingProposals(supabase, user.id, { dayId: day.id })
        : [];

    const backHref = day.party_id ? `/parties/${day.party_id}` : "/";
    // anyone's logged set pins a program day in place
    const dayLogged = (logs ?? []).some(
        l => l.weight != null || l.reps != null || l.distance != null,
    );
    const todayISO = await getUserToday();

    return (
        <div className='flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
                <Link
                    href={backHref}
                    className='flex items-center gap-1 text-sm text-text-muted hover:text-text'>
                    <ChevronLeftIcon />
                    {day.party_id ? "Party" : "Calendar"}
                </Link>
                {canDeleteDay && <DeleteDayButton dayId={day.id} />}
            </div>
            <div>
                <h1 className='text-lg font-semibold'>
                    {formatLong(day.date)}
                </h1>
                {/* a day loaded from a program: its name, where it falls in the
            program, and a way out for the member following it */}
                {day.programs && day.program_day_number ? (
                    <div className='mt-1.5 flex flex-wrap items-center justify-between gap-2'>
                        {/* same pill + "Day # - name" as on the Calendar */}
                        <p className='flex items-center gap-2 text-sm'>
                            <span
                                title={`${day.programs.name} Program`}
                                className={`rounded-md border px-2 py-0.5 text-xs ${PROGRAM_STYLE}`}>
                                Program
                            </span>
                            <span className='text-text-muted'>
                                Day {day.program_day_number}
                                {day.label && ` - ${day.label}`}
                            </span>
                        </p>
                        {followingThisProgram && (
                            <StopProgramButton redirectTo='/' />
                        )}
                    </div>
                ) : (
                    day.label &&
                    !day.category && (
                        <p className='text-sm font-medium'>{day.label}</p>
                    )
                )}
                {day.party_id && (
                    <p className='text-sm text-text-muted'>
                        Shared with{" "}
                        <Link
                            href={`/parties/${day.party_id}`}
                            className='underline'>
                            {day.parties?.name ?? "party"}
                        </Link>
                        {" · "}your sets log to your own profile
                    </p>
                )}
            </div>

            {day.party_id && (
                <RealtimeRefresh
                    channel={`proposals:${day.id}`}
                    tables={[
                        {
                            table: "party_change_proposals",
                            filter: `recipient=eq.${user.id}`,
                        },
                    ]}
                />
            )}

            <DayEditor
                day={{
                    id: day.id,
                    date: day.date,
                    category: day.category,
                    partyId: day.party_id,
                    isDeload: day.is_deload,
                    exercises: [...day.planned_day_exercises]
                        .sort((a, b) => a.sort - b.sort)
                        .map(p => {
                            const e = effectiveTarget(p);
                            return {
                                id: p.id,
                                targetSets: e.sets,
                                targetRepMin: e.repMin,
                                targetRepMax: e.repMax,
                                targetWeight: e.weight,
                                targetDistance: e.distance,
                                logMode: e.logMode,
                                isOneRm:
                                    targetByPde.get(`${user.id}:${p.id}`)
                                        ?.is_one_rm ?? false,
                                addedBy: p.added_by,
                                fromProgram: p.from_program,
                                programSetReps: parseSetReps(
                                    p.program_set_reps,
                                ),
                                supersetGroup: p.superset_group,
                                exercise: {
                                    ...p.exercises,
                                    timeBased: p.exercises.time_based,
                                },
                            };
                        }),
                }}
                currentUserId={user.id}
                canManageAll={canManageAll}
                members={members}
                logs={logs ?? []}
                notes={notes ?? []}
                catalog={(catalog ?? []).map(c => ({
                    ...c,
                    timeBased: c.time_based,
                }))}
                lastByExercise={prevByExercise}
                proposals={proposals}
                // every other member's targets on this party day, for when
                // you log for them
                memberTargets={Object.fromEntries(
                    partyMemberIds
                        .filter(uid => uid !== user.id)
                        .map(uid => [
                            uid,
                            Object.fromEntries(
                                day.planned_day_exercises.map(p => {
                                    const e = effectiveTarget(p, uid);
                                    return [
                                        p.id,
                                        {
                                            targetSets: e.sets,
                                            targetRepMin: e.repMin,
                                            targetRepMax: e.repMax,
                                            targetWeight: e.weight,
                                            targetDistance: e.distance,
                                            logMode: e.logMode,
                                        },
                                    ];
                                }),
                            ),
                        ]),
                )}
                favorites={(favoriteRows ?? []).map(f => f.exercise_id)}
                // skipping a program day: slide it and the rest of its program
                // week later (only while nothing's logged on it)
                slideControl={
                    day.program_run_id &&
                    day.program_day_number &&
                    !dayLogged ? (
                        <SlideProgramDay
                            dayId={day.id}
                            dayNumber={day.program_day_number}
                            date={day.date}
                            todayISO={todayISO}
                        />
                    ) : null
                }
                goal={goal}
                experience={constants?.experience ?? null}
                focusMuscles={constants?.focus_muscles ?? []}
                units={(profile?.units as Unit) ?? "lb"}
                distanceUnit={distanceUnitLabel(profile?.distance_unit)}
            />
        </div>
    );
}
