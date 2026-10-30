import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startProgram } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ChevronLeftIcon } from "@/components/icons";
import { addDays, formatShort } from "@/lib/date";
import { ProgramProgressList } from "@/components/program-progress-list";
import { fetchProgramProgress } from "@/lib/program-progress";
import { unitLabel, type Unit } from "@/lib/units";
import { getUserToday } from "@/lib/user-today";
import { muscleList } from "@/lib/labels";
import { toBlocks } from "@/lib/supersets";
import {
    describeSets,
    DIFFICULTY_LABEL,
    DIFFICULTY_STYLE,
    durationLabel,
    parseDifficulty,
    parseSetReps,
    programTotalDays,
} from "@/lib/programs";

export default async function ProgramDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ start?: string; party?: string }>;
}) {
    const { id } = await params;
    const { start, party: partyParam } = await searchParams;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const todayISO = await getUserToday();
    const [{ data: program }, { data: run }] = await Promise.all([
        supabase
            .from("programs")
            .select(
                "id, name, description, difficulty, duration_unit, duration_count, program_days(id, position, name, is_rest, program_exercises(id, sort, sets, rep_min, rep_max, set_reps, superset_group, exercises(id, name, primary_muscles, time_based, default_sets, default_rep_min, default_rep_max)))",
            )
            .eq("id", id)
            .maybeSingle(),
        supabase
            .from("user_programs")
            .select("program_id, start_date, end_date, programs(name)")
            .eq("user_id", user.id)
            .maybeSingle(),
    ]);
    if (!program) notFound();

    // your progress: this run while you're following it, else every run of it
    // that's still on your calendar
    const activeRun =
        run && run.program_id === program.id && run.end_date >= todayISO
            ? run
            : null;
    const [progress, { data: profile }] = await Promise.all([
        fetchProgramProgress(
            supabase,
            user.id,
            program.id,
            activeRun
                ? { start: activeRun.start_date, end: activeRun.end_date }
                : undefined,
        ),
        supabase
            .from("profiles")
            .select("units")
            .eq("id", user.id)
            .maybeSingle(),
    ]);
    const u = unitLabel((profile?.units as Unit) ?? "lb");

    const difficulty = parseDifficulty(program.difficulty);
    const days = [...program.program_days].sort(
        (a, b) => a.position - b.position,
    );
    const unit = program.duration_unit === "days" ? "days" : "weeks";
    const total = programTotalDays(unit, program.duration_count);
    const sessions = Array.from({ length: total }, (_, i) =>
        days.length ? days[i % days.length] : null,
    ).filter(d => d && !d.is_rest).length;
    // the run laid out week by week (rest days included), so the week and day
    // you're on can be picked out
    // Every week of the program, each day with the cycle day it falls on. When
    // you're following it the days also carry their dates and what you've done.
    const weeks = days.length
        ? Array.from({ length: Math.ceil(total / 7) }, (_, w) => ({
              entries: Array.from(
                  { length: Math.min(7, total - w * 7) },
                  (_, k) => {
                      const i = w * 7 + k;
                      const date = activeRun
                          ? addDays(activeRun.start_date, i)
                          : null;
                      return {
                          i,
                          d: days[i % days.length],
                          date,
                          planned: date
                              ? progress.days.find(p => p.date === date)
                              : undefined,
                      };
                  },
              ),
          }))
        : [];
    const thisWeek = weeks.findIndex(w =>
        w.entries.some(e => e.date === todayISO),
    );
    // arriving from a Calendar day's "Plan session…" pre-fills that date
    const defaultStart = /^\d{4}-\d{2}-\d{2}$/.test(start ?? "")
        ? start!
        : todayISO;
    // arriving from a party's "Plan session…": load it onto the party's
    // calendar instead (parties are only visible to their members)
    const { data: party } = partyParam
        ? await supabase
              .from("parties")
              .select("id, name")
              .eq("id", partyParam)
              .maybeSingle()
        : { data: null };
    const followingOther = !party && run && run.program_id !== program.id;

    return (
        <div className='flex flex-col gap-4'>
            <Link
                href='/programs'
                className='flex items-center gap-1 text-sm text-text-muted hover:text-text'>
                <ChevronLeftIcon />
                Programs
            </Link>

            <div>
                <div className='flex items-start justify-between gap-2'>
                    <h1 className='text-lg font-semibold'>{program.name}</h1>
                    <span className='flex shrink-0 items-center gap-1.5'>
                        {difficulty && (
                            <span
                                className={`rounded-md border px-1.5 py-0.5 text-xs ${DIFFICULTY_STYLE[difficulty]}`}>
                                {DIFFICULTY_LABEL[difficulty]}
                            </span>
                        )}
                        <span className='rounded-md border border-border px-1.5 py-0.5 text-xs text-text-muted'>
                            {durationLabel(
                                program.duration_unit,
                                program.duration_count,
                            )}
                        </span>
                    </span>
                </div>
                <p className='text-xs text-text-muted'>
                    {days.length}-day cycle · {sessions} training{" "}
                    {sessions === 1 ? "session" : "sessions"} over {total}{" "}
                    {total === 1 ? "day" : "days"}
                </p>
                {program.description && (
                    <p className='mt-2 text-sm text-text-muted'>
                        {program.description}
                    </p>
                )}
            </div>

            {/* what the repeating cycle is made of */}
            <section className='flex flex-col gap-2'>
                <h2 className='text-sm font-medium'>
                    The program, week by week
                </h2>
                {weeks.map((week, wi) => {
                    const isNow = wi === thisWeek;
                    const trainDays = week.entries.filter(e => !e.d.is_rest);
                    const doneCount = trainDays.filter(
                        e => e.planned?.done,
                    ).length;
                    return (
                        <details
                            key={wi}
                            open={isNow}
                            className={`rounded-xl border ${
                                isNow
                                    ? "border-accent/60 bg-accent/5"
                                    : "border-border"
                            }`}>
                            <summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm'>
                                <span className='flex items-center gap-2 font-medium'>
                                    Week {wi + 1}
                                    {isNow && (
                                        <span className='rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent'>
                                            This week
                                        </span>
                                    )}
                                </span>
                                <span className='text-xs text-text-muted'>
                                    {activeRun
                                        ? `${doneCount}/${trainDays.length} done`
                                        : `${trainDays.length} training ${trainDays.length === 1 ? "day" : "days"}`}{" "}
                                    ▾
                                </span>
                            </summary>
                            {/* a capped height: the days scroll inside the week
                                instead of stretching the whole page */}
                            <div className='flex max-h-[60vh] flex-col gap-2 overflow-y-auto overscroll-contain border-t border-border p-2'>
                                {week.entries.map(({ d, i, date, planned }) => {
                                    const isToday = date === todayISO;
                                    const exercises = [...d.program_exercises]
                                        .sort((a, b) => a.sort - b.sort)
                                        .flatMap(e =>
                                            e.exercises
                                                ? [{ ...e, ex: e.exercises }]
                                                : [],
                                        );
                                    return (
                                        <div
                                            key={i}
                                            className={`rounded-xl border p-4 ${
                                                isToday
                                                    ? "border-accent/60 bg-accent/10"
                                                    : "border-border"
                                            }`}>
                                            <div className='flex items-baseline justify-between gap-2'>
                                                <span className='font-medium'>
                                                    <span className='mr-2 text-xs font-normal text-text-muted'>
                                                        Day {i + 1}
                                                        {date &&
                                                            ` · ${formatShort(date)}`}
                                                    </span>
                                                    {d.name}
                                                </span>
                                                <span className='flex shrink-0 items-center gap-1.5 text-xs'>
                                                    {isToday && (
                                                        <span className='rounded bg-accent/15 px-1.5 py-0.5 font-semibold text-accent'>
                                                            Today
                                                        </span>
                                                    )}
                                                    {d.is_rest ? (
                                                        <span className='text-text-muted'>
                                                            Rest
                                                        </span>
                                                    ) : planned?.done ? (
                                                        <span className='text-emerald-500'>
                                                            ✓ Done
                                                        </span>
                                                    ) : (
                                                        date &&
                                                        date < todayISO && (
                                                            <span className='text-text-muted'>
                                                                Not logged
                                                            </span>
                                                        )
                                                    )}
                                                    {planned && (
                                                        <Link
                                                            href={`/day/${planned.id}`}
                                                            className='text-accent hover:underline'>
                                                            Open
                                                        </Link>
                                                    )}
                                                </span>
                                            </div>
                                            {!d.is_rest &&
                                                (exercises.length === 0 ? (
                                                    <p className='mt-2 text-sm text-text-muted'>
                                                        No exercises.
                                                    </p>
                                                ) : (
                                                    <ol className='mt-2 flex flex-col gap-2 text-sm'>
                                                        {toBlocks(
                                                            exercises.map(
                                                                e => ({
                                                                    group: e.superset_group,
                                                                    e,
                                                                }),
                                                            ),
                                                        ).map(block => {
                                                            const rows = (
                                                                <ol className='flex flex-col divide-y divide-border'>
                                                                    {block.items.map(
                                                                        ({
                                                                            item: {
                                                                                e,
                                                                            },
                                                                            index: j,
                                                                        }) => (
                                                                            <li
                                                                                key={
                                                                                    e.id
                                                                                }
                                                                                className='flex items-center justify-between gap-3 py-2'>
                                                                                <span className='flex min-w-0 items-baseline gap-2'>
                                                                                    <span className='w-4 shrink-0 text-xs text-text-muted'>
                                                                                        {j +
                                                                                            1}
                                                                                    </span>
                                                                                    <span className='min-w-0'>
                                                                                        <span className='block'>
                                                                                            {
                                                                                                e
                                                                                                    .ex
                                                                                                    .name
                                                                                            }
                                                                                        </span>
                                                                                        <span className='block text-xs text-text-muted'>
                                                                                            {muscleList(
                                                                                                e
                                                                                                    .ex
                                                                                                    .primary_muscles,
                                                                                            )}
                                                                                        </span>
                                                                                    </span>
                                                                                </span>
                                                                                <span className='shrink-0 text-right text-xs text-text-muted'>
                                                                                    {describeSets(
                                                                                        e.sets ??
                                                                                            e
                                                                                                .ex
                                                                                                .default_sets,
                                                                                        parseSetReps(
                                                                                            e.set_reps,
                                                                                        ),
                                                                                        e.rep_min ??
                                                                                            e
                                                                                                .ex
                                                                                                .default_rep_min,
                                                                                        e.rep_max ??
                                                                                            e
                                                                                                .ex
                                                                                                .default_rep_max,
                                                                                        e
                                                                                            .ex
                                                                                            .time_based,
                                                                                    )}
                                                                                </span>
                                                                            </li>
                                                                        ),
                                                                    )}
                                                                </ol>
                                                            );
                                                            // a superset: back-to-back exercises, outlined in gold
                                                            return block.group !=
                                                                null &&
                                                                block.items
                                                                    .length >=
                                                                    2 ? (
                                                                <li
                                                                    key={`g${block.group}`}
                                                                    className='rounded-xl border-2 border-amber-400/70 bg-amber-400/5 px-3 pb-1 pt-2'>
                                                                    <div className='text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300'>
                                                                        Superset
                                                                    </div>
                                                                    {rows}
                                                                </li>
                                                            ) : (
                                                                <li
                                                                    key={
                                                                        block
                                                                            .items[0]
                                                                            .item
                                                                            .e
                                                                            .id
                                                                    }>
                                                                    {rows}
                                                                </li>
                                                            );
                                                        })}
                                                    </ol>
                                                ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </details>
                    );
                })}
            </section>

            {(activeRun || progress.doneDays > 0) && (
                <section className='flex flex-col gap-2 rounded-xl border border-border px-4 py-3'>
                    <div className='flex items-baseline justify-between gap-2'>
                        <h2 className='text-sm font-medium'>Your progress</h2>
                        <span className='text-xs text-text-muted'>
                            {activeRun
                                ? `${formatShort(activeRun.start_date)} – ${formatShort(activeRun.end_date)}`
                                : "all runs"}
                        </span>
                    </div>
                    <div>
                        <div className='mb-1 flex justify-between text-xs text-text-muted'>
                            <span>
                                {progress.doneDays} of {progress.plannedDays}{" "}
                                sessions done
                            </span>
                            <span>
                                {progress.plannedDays
                                    ? Math.round(
                                          (progress.doneDays /
                                              progress.plannedDays) *
                                              100,
                                      )
                                    : 0}
                                %
                            </span>
                        </div>
                        <div className='h-1.5 overflow-hidden rounded-full bg-surface-2'>
                            <div
                                className='h-full rounded-full bg-accent/70'
                                style={{
                                    width: `${
                                        progress.plannedDays
                                            ? (progress.doneDays /
                                                  progress.plannedDays) *
                                              100
                                            : 0
                                    }%`,
                                }}
                            />
                        </div>
                    </div>
                    <p className='flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm'>
                        <span>
                            <span className='font-semibold tabular-nums'>
                                {progress.sets}
                            </span>{" "}
                            <span className='text-text-muted'>sets</span>
                        </span>
                        <span className='text-text-muted'>·</span>
                        <span>
                            <span className='font-semibold tabular-nums'>
                                {progress.volume.toLocaleString()} {u}
                            </span>{" "}
                            <span className='text-text-muted'>
                                total volume
                            </span>
                        </span>
                    </p>
                    {progress.exercises.length > 0 && (
                        <ProgramProgressList
                            exercises={progress.exercises}
                            unit={u}
                        />
                    )}
                </section>
            )}

            <form
                action={startProgram}
                className='flex flex-col gap-3 rounded-xl border border-border p-4'>
                <input
                    type='hidden'
                    name='program_id'
                    value={program.id}
                />
                {party && (
                    <input
                        type='hidden'
                        name='party_id'
                        value={party.id}
                    />
                )}
                <span className='text-sm font-medium'>
                    {party
                        ? `Start this program for ${party.name}`
                        : "Start this program"}
                </span>
                <label className='flex items-center gap-2 text-sm text-text-muted'>
                    Starting
                    <input
                        type='date'
                        name='start_date'
                        required
                        defaultValue={defaultStart}
                        className='rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text'
                    />
                </label>
                <p className='text-xs text-text-muted'>
                    The cycle above repeats from this date for{" "}
                    {durationLabel(
                        program.duration_unit,
                        program.duration_count,
                    )}
                    .{" "}
                    {party
                        ? `Every training day is added to ${party.name} as a shared day for everyone in the party, with its exercises, sets and target reps; rest days stay empty. Each member logs to their own profile, and days come off one at a time.`
                        : "Every training day is added to your calendar with its exercises, sets and target reps; rest days stay empty."}
                    {followingOther &&
                        ` This replaces ${run.programs?.name ?? "the program"} as the one you're following — days it already added stay on your calendar.`}
                </p>
                <SubmitButton
                    pendingText='Loading…'
                    className='self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50'>
                    Start program
                </SubmitButton>
            </form>
        </div>
    );
}
