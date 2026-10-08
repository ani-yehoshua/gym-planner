'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { addDays } from '@/lib/date';
import { DEFAULT_SETS } from '@/lib/targets';
import { distanceUnitLabel } from '@/lib/units';
import { getUserToday } from '@/lib/user-today';
import {
    makeSuperset,
    moveItem,
    normalizeGroups,
    ungroup,
} from '@/lib/supersets';
import {
    clampDuration,
    parseDifficulty,
    parseSetReps,
    programEndDate,
    programTotalDays,
    summarizeSetReps,
    type DurationUnit,
    type ProgramInput,
} from '@/lib/programs';
import { isAdmin, notifyExerciseRequest } from '@/lib/admin';
import { epley1rm, round5, WORKING_REPS } from '@/lib/one-rm';
import type { Enums } from '@/lib/supabase/database.types';

async function requireUser() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    return { supabase, user };
}

/** Throw (instead of silently no-op) when a Supabase write fails. */
function check({ error }: { error: { message: string } | null }, what: string) {
    if (error) throw new Error(`${what}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// onboarding
// ---------------------------------------------------------------------------
export async function saveOnboarding(formData: FormData) {
    const { supabase, user } = await requireUser();

    const displayName = String(formData.get('display_name') || '').trim();
    const units =
        (String(formData.get('units')) as Enums<'unit_system'>) || 'lb';
    const distanceUnit = distanceUnitLabel(
        String(formData.get('distance_unit')),
    );
    const experience = String(formData.get('experience') || '') as
        | Enums<'experience_level'>
        | '';
    const primaryGoal = String(formData.get('primary_goal') || '');
    const focusMuscles = formData
        .getAll('focus_muscles')
        .map(String) as Enums<'muscle_group'>[];
    const num = (k: string) => {
        const v = formData.get(k);
        return v === null || v === '' ? null : Number(v);
    };

    check(
        await supabase
            .from('profiles')
            .update({
                display_name: displayName || null,
                units,
                distance_unit: distanceUnit,
                onboarded_at: new Date().toISOString(),
            })
            .eq('id', user.id),
        'save profile',
    );

    check(
        await supabase
            .from('user_constants')
            .update({
                experience: experience || null,
                primary_goal: primaryGoal || null,
                focus_muscles: focusMuscles,
                current_bodyweight: num('current_bodyweight'),
                target_bodyweight: num('target_bodyweight'),
                weekly_gain_target: num('weekly_gain_target'),
            })
            .eq('user_id', user.id),
        'save constants',
    );

    const templateId = String(formData.get('template_id') || '');
    if (templateId && templateId !== 'none') {
        const t = await loadTemplate(supabase, templateId);
        if (t) {
            await materializeSplit(supabase, user.id, {
                slots: t.slots,
                exercisesByCategory: t.exercisesByCategory,
                weeks: t.defaultWeeks,
            });
        }
    }

    redirect('/');
}

// ---------------------------------------------------------------------------
// account — edit onboarding answers later
// ---------------------------------------------------------------------------
export async function updateDisplayName(formData: FormData) {
    const { supabase, user } = await requireUser();
    const name = String(formData.get('display_name') || '').trim();
    check(
        await supabase
            .from('profiles')
            .update({ display_name: name || null })
            .eq('id', user.id),
        'update display name',
    );
    revalidatePath('/account');
    revalidatePath('/', 'layout');
}

export async function updateAccount(formData: FormData) {
    const { supabase, user } = await requireUser();

    const units =
        (String(formData.get('units')) as Enums<'unit_system'>) || 'lb';
    const distanceUnit = distanceUnitLabel(
        String(formData.get('distance_unit')),
    );
    const experience = String(formData.get('experience') || '') as
        | Enums<'experience_level'>
        | '';
    const primaryGoal = String(formData.get('primary_goal') || '');
    const focusMuscles = formData
        .getAll('focus_muscles')
        .map(String) as Enums<'muscle_group'>[];
    const num = (k: string) => {
        const v = formData.get(k);
        return v === null || v === '' ? null : Number(v);
    };

    check(
        await supabase
            .from('profiles')
            .update({ units, distance_unit: distanceUnit })
            .eq('id', user.id),
        'update profile',
    );

    check(
        await supabase
            .from('user_constants')
            .update({
                experience: experience || null,
                primary_goal: primaryGoal || null,
                focus_muscles: focusMuscles,
                current_bodyweight: num('current_bodyweight'),
                target_bodyweight: num('target_bodyweight'),
                weekly_gain_target: num('weekly_gain_target'),
            })
            .eq('user_id', user.id),
        'update constants',
    );

    revalidatePath('/account');
}

export async function updateTimezone(formData: FormData) {
    const { supabase, user } = await requireUser();
    const tz = String(formData.get('timezone') || '').trim();
    if (!tz) return;
    // sanity-check it's a real IANA zone
    try {
        new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    } catch {
        return;
    }
    check(
        await supabase
            .from('profiles')
            .update({ timezone: tz })
            .eq('id', user.id),
        'update timezone',
    );
    revalidatePath('/account');
    revalidatePath('/');
}

/** Delete every solo planned day from today forward (before re-applying a template). */
export async function clearUpcomingCalendar() {
    const { supabase, user } = await requireUser();
    const todayISO = new Date().toISOString().slice(0, 10);
    check(
        await supabase
            .from('planned_days')
            .delete()
            .eq('owner_user', user.id)
            .gte('date', todayISO),
        'clear calendar',
    );
    revalidatePath('/');
    revalidatePath('/account');
}

// ---------------------------------------------------------------------------
// templates / splits
// ---------------------------------------------------------------------------
type Cat = Enums<'muscle_category'>;
type ExRow = {
    exercise_id: string;
    sort: number;
    sets: number | null;
    rep_min: number | null;
    rep_max: number | null;
};

const LABEL: Partial<Record<Cat, string>> = {
    full_body: 'Full Body',
    rest: 'Rest',
};
const catLabel = (c: Cat) => LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1);

/** Write `weeks` copies of a 7-slot pattern onto the user's calendar. */
async function materializeSplit(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    opts: {
        slots: (Cat | null)[]; // index = position 0..6, null / "rest" = off day
        exercisesByCategory: Map<Cat, ExRow[]>;
        fromDate?: string;
        weeks: number;
    },
) {
    // slot 0 lands exactly on the chosen start date; the pattern repeats every 7 days
    const start = opts.fromDate ?? new Date().toISOString().slice(0, 10);

    for (let w = 0; w < opts.weeks; w++) {
        for (let pos = 0; pos < opts.slots.length; pos++) {
            const cat = opts.slots[pos];
            if (!cat || cat === 'rest') continue;
            const date = addDays(start, w * 7 + pos);

            const { data: day } = await supabase
                .from('planned_days')
                .insert({
                    owner_user: userId,
                    date,
                    category: cat,
                    label: catLabel(cat),
                    created_by: userId,
                })
                .select('id')
                .single();
            if (!day) continue;

            const exs = opts.exercisesByCategory.get(cat) ?? [];
            if (exs.length) {
                // seed = the template's numbers only; the user's own prefs are layered
                // on at view time via effectiveTarget()
                await supabase.from('planned_day_exercises').insert(
                    exs.map(e => ({
                        planned_day_id: day.id,
                        exercise_id: e.exercise_id,
                        sort: e.sort,
                        target_sets: e.sets ?? DEFAULT_SETS,
                        target_rep_min: e.rep_min,
                        target_rep_max: e.rep_max,
                        target_weight: null,
                        added_by: userId,
                    })),
                );
            }
        }
    }
}

/** Load a template's slot pattern + its exercise list keyed by category. */
async function loadTemplate(
    supabase: Awaited<ReturnType<typeof createClient>>,
    templateId: string,
) {
    const { data: tmpl } = await supabase
        .from('schedule_templates')
        .select(
            'default_weeks, template_days(position, category, template_day_exercises(exercise_id, sort, sets, rep_min, rep_max))',
        )
        .eq('id', templateId)
        .single();
    if (!tmpl) return null;

    const slots: (Cat | null)[] = Array(7).fill(null);
    const exercisesByCategory = new Map<Cat, ExRow[]>();
    for (const td of tmpl.template_days) {
        if (td.position >= 0 && td.position < 7)
            slots[td.position] = td.category;
        if (!exercisesByCategory.has(td.category)) {
            exercisesByCategory.set(
                td.category,
                [...td.template_day_exercises].sort((a, b) => a.sort - b.sort),
            );
        }
    }
    return { slots, exercisesByCategory, defaultWeeks: tmpl.default_weeks };
}

export async function applyTemplate(formData: FormData) {
    const { supabase, user } = await requireUser();
    const templateId = String(formData.get('template_id'));
    const t = await loadTemplate(supabase, templateId);
    if (!t) redirect('/account');

    await materializeSplit(supabase, user.id, {
        slots: t.slots,
        exercisesByCategory: t.exercisesByCategory,
        fromDate: String(formData.get('from_date') || '') || undefined,
        weeks: formData.get('weeks')
            ? Number(formData.get('weeks'))
            : t.defaultWeeks,
    });
    revalidatePath('/');
    redirect('/');
}

/** Apply a reordered / edited 7-slot split. `source_template_id` (optional)
 *  supplies the exercise lists per category. */
export async function applyCustomSplit(formData: FormData) {
    const { supabase, user } = await requireUser();

    const slots = Array.from({ length: 7 }, (_, i) => {
        const v = String(formData.get(`slot_${i}`) || 'rest');
        return v === 'rest' ? null : (v as Cat);
    });

    let exercisesByCategory = new Map<Cat, ExRow[]>();
    const sourceId = String(formData.get('source_template_id') || '');
    if (sourceId) {
        const t = await loadTemplate(supabase, sourceId);
        if (t) exercisesByCategory = t.exercisesByCategory;
    }

    await materializeSplit(supabase, user.id, {
        slots,
        exercisesByCategory,
        fromDate: String(formData.get('from_date') || '') || undefined,
        weeks: formData.get('weeks') ? Number(formData.get('weeks')) : 8,
    });
    revalidatePath('/');
    redirect('/');
}

// ---------------------------------------------------------------------------
// exercises
// ---------------------------------------------------------------------------
/** parse "chest, front delts, custom thing" -> ["chest","front_delts","custom thing"] */
function parseMuscles(raw: string): string[] {
    return raw
        .split(',')
        .map(s => s.trim().toLowerCase().replace(/\s+/g, '_'))
        .filter(Boolean);
}

function exerciseFieldsFromForm(formData: FormData) {
    const numOrNull = (k: string) => {
        const v = formData.get(k);
        return v === null || v === ''
            ? null
            : Math.max(1, Math.min(999, Number(v)));
    };
    const measurement = (String(formData.get('measurement') || 'reps') ||
        'reps') as Enums<'exercise_measurement'>;
    const distanceRaw = formData.get('default_distance');
    return {
        name: String(formData.get('name') || '').trim(),
        category: String(formData.get('category')) as Enums<'muscle_category'>,
        primary_muscles: parseMuscles(
            String(formData.get('primary_muscles') || ''),
        ),
        secondary_muscles: parseMuscles(
            String(formData.get('secondary_muscles') || ''),
        ),
        howto_text: String(formData.get('howto_text') || '').trim() || null,
        media_url: String(formData.get('media_url') || '').trim() || null,
        default_sets: numOrNull('default_sets'),
        default_rep_min: numOrNull('default_rep_min'),
        default_rep_max: numOrNull('default_rep_max'),
        default_distance:
            distanceRaw === null || distanceRaw === ''
                ? null
                : Math.max(0, Number(distanceRaw)),
        measurement,
        time_based:
            measurement === 'time' || measurement === 'time_or_distance',
        weighted: formData.get('weighted') === 'true',
        // grip variants of one lift share a group name; both blank = not one
        variant_group:
            String(formData.get('variant_group') || '').trim() || null,
        variant_label:
            String(formData.get('variant_label') || '').trim() || null,
    };
}

export async function createExercise(formData: FormData) {
    const { supabase, user } = await requireUser();
    if (!(await isAdmin(supabase))) throw new Error('Admins only');

    const fields = exerciseFieldsFromForm(formData);
    if (!fields.name || !fields.category) return;
    check(
        await supabase
            .from('exercises')
            .insert({ ...fields, created_by: user.id, is_public: true }),
        'create exercise',
    );

    const requestId = String(formData.get('request_id') || '');
    if (requestId) {
        await supabase
            .from('exercise_requests')
            .update({ status: 'done' })
            .eq('id', requestId);
    }
    revalidatePath('/exercises');
}

export async function updateExercise(formData: FormData) {
    const { supabase } = await requireUser();
    if (!(await isAdmin(supabase))) throw new Error('Admins only');

    const id = String(formData.get('exercise_id'));
    const fields = exerciseFieldsFromForm(formData);
    if (!id || !fields.name || !fields.category) return;
    check(
        await supabase.from('exercises').update(fields).eq('id', id),
        'update exercise',
    );
    revalidatePath('/exercises');
}

export async function requestExercise(formData: FormData) {
    const { supabase, user } = await requireUser();
    const name = String(formData.get('name') || '').trim();
    const note = String(formData.get('note') || '').trim() || null;
    if (!name) return;

    check(
        await supabase
            .from('exercise_requests')
            .insert({ user_id: user.id, name, note }),
        'submit request',
    );
    await notifyExerciseRequest({ name, note, fromEmail: user.email ?? null });
    revalidatePath('/exercises');
}

export async function dismissExerciseRequest(formData: FormData) {
    const { supabase } = await requireUser();
    if (!(await isAdmin(supabase))) throw new Error('Admins only');
    await supabase
        .from('exercise_requests')
        .update({ status: 'dismissed' })
        .eq('id', String(formData.get('request_id')));
    revalidatePath('/exercises');
}

export async function setExerciseArchived(formData: FormData) {
    const { supabase } = await requireUser();
    if (!(await isAdmin(supabase))) throw new Error('Admins only');
    const id = String(formData.get('exercise_id'));
    const archived = String(formData.get('archived')) === 'true';
    check(
        await supabase
            .from('exercises')
            .update({ archived_at: archived ? new Date().toISOString() : null })
            .eq('id', id),
        'archive exercise',
    );
    revalidatePath('/exercises');
}

export async function deleteExercise(formData: FormData) {
    const { supabase } = await requireUser();
    if (!(await isAdmin(supabase))) throw new Error('Admins only');
    const id = String(formData.get('exercise_id'));

    const { count } = await supabase
        .from('planned_day_exercises')
        .select('id', { count: 'exact', head: true })
        .eq('exercise_id', id);
    if ((count ?? 0) > 0) {
        throw new Error(
            "This exercise is on someone's planned day — archive it instead of deleting.",
        );
    }
    check(
        await supabase.from('exercises').delete().eq('id', id),
        'delete exercise',
    );
    revalidatePath('/exercises');
}

// ---------------------------------------------------------------------------
// planned days
// ---------------------------------------------------------------------------
/** Always creates a new personal session on that date — a day can hold several
 *  (e.g. a party session and a solo session, or a 2-a-day). */
export async function createDay(formData: FormData) {
    const { supabase, user } = await requireUser();
    const date = String(formData.get('date'));
    const category = String(formData.get('category') || '') as
        | Enums<'muscle_category'>
        | '';
    if (!date) redirect('/');

    const { data: created } = await supabase
        .from('planned_days')
        .insert({
            owner_user: user.id,
            date,
            category: category || null,
            created_by: user.id,
        })
        .select('id')
        .single();

    if (created) redirect(`/day/${created.id}`);
    redirect('/');
}

export async function setDayCategory(
    dayId: string,
    category: Enums<'muscle_category'>,
) {
    const { supabase } = await requireUser();
    await supabase.from('planned_days').update({ category }).eq('id', dayId);
    revalidatePath(`/day/${dayId}`);
}

export async function setDayDeload(dayId: string, isDeload: boolean) {
    const { supabase } = await requireUser();
    await supabase
        .from('planned_days')
        .update({ is_deload: isDeload })
        .eq('id', dayId);
    revalidatePath(`/day/${dayId}`);
}

export async function deleteDay(dayId: string) {
    const { supabase } = await requireUser();
    const { data: day } = await supabase
        .from('planned_days')
        .select('party_id')
        .eq('id', dayId)
        .maybeSingle();
    await supabase.from('planned_days').delete().eq('id', dayId);
    redirect(day?.party_id ? `/parties/${day.party_id}` : '/');
}

export async function addExerciseToDay(dayId: string, exerciseId: string) {
    const { supabase, user } = await requireUser();

    const [{ data: ex }, { data: pref }, { data: maxRow }] = await Promise.all([
        supabase
            .from('exercises')
            .select('default_sets, default_rep_min, default_rep_max')
            .eq('id', exerciseId)
            .single(),
        supabase
            .from('user_exercise_prefs')
            .select(
                'default_sets, default_rep_min, default_rep_max, default_weight',
            )
            .eq('user_id', user.id)
            .eq('exercise_id', exerciseId)
            .maybeSingle(),
        supabase
            .from('planned_day_exercises')
            .select('sort')
            .eq('planned_day_id', dayId)
            .order('sort', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    // shared row seed = the exercise's catalog default, or nothing. Never the
    // adder's personal numbers (weight especially is per-person) and never their
    // goal-based rep suggestion — that would pin the adder's goal onto everyone
    // else's view. Each viewer's own values and goal suggestion are layered on at
    // view time (effectiveTarget in day/[id]/page.tsx).
    const { data: created } = await supabase
        .from('planned_day_exercises')
        .insert({
            planned_day_id: dayId,
            exercise_id: exerciseId,
            sort: (maxRow?.sort ?? -1) + 1,
            target_sets: ex?.default_sets ?? DEFAULT_SETS,
            target_rep_min: ex?.default_rep_min ?? null,
            target_rep_max: ex?.default_rep_max ?? null,
            target_weight: null,
            added_by: user.id,
        })
        .select('id')
        .single();

    // give the adder their own target row immediately from their prefs
    if (created && pref) {
        await supabase.from('day_exercise_user_targets').upsert(
            {
                planned_day_exercise_id: created.id,
                user_id: user.id,
                target_sets: pref.default_sets,
                target_rep_min: pref.default_rep_min,
                target_rep_max: pref.default_rep_max,
                target_weight: pref.default_weight,
            },
            { onConflict: 'planned_day_exercise_id,user_id' },
        );
    }
    revalidatePath(`/day/${dayId}`);
}

// ---------------------------------------------------------------------------
// per-exercise notes on a day
// ---------------------------------------------------------------------------
export async function saveExerciseNote(input: {
    pdeId: string;
    dayId: string;
    note: string;
}) {
    const { supabase, user } = await requireUser();
    const note = input.note.trim();
    if (note === '') {
        await supabase
            .from('day_exercise_notes')
            .delete()
            .eq('planned_day_exercise_id', input.pdeId)
            .eq('user_id', user.id);
    } else {
        check(
            await supabase.from('day_exercise_notes').upsert(
                {
                    planned_day_exercise_id: input.pdeId,
                    user_id: user.id,
                    note,
                },
                { onConflict: 'planned_day_exercise_id,user_id' },
            ),
            'save note',
        );
    }
    revalidatePath(`/day/${input.dayId}`);
}

// ---------------------------------------------------------------------------
// per-user exercise defaults (Exercises tab)
// ---------------------------------------------------------------------------
export async function setExercisePref(formData: FormData) {
    const { supabase, user } = await requireUser();
    const exerciseId = String(formData.get('exercise_id'));
    const n = (k: string) => {
        const v = formData.get(k);
        return v === null || v === ''
            ? null
            : Math.max(1, Math.min(999, Number(v)));
    };
    const sets = n('default_sets');
    const repMin = n('default_rep_min');
    const repMax = n('default_rep_max');
    const w = (k: string) => {
        const v = formData.get(k);
        return v === null || v === '' ? null : Math.max(0, Number(v));
    };
    const weight = w('default_weight');
    const oneRm = w('default_1rm');
    const distance = w('default_distance');
    const logModeRaw = String(formData.get('default_log_mode') || '');
    const logMode =
        logModeRaw === 'time' || logModeRaw === 'distance' ? logModeRaw : null;

    if (
        sets === null &&
        repMin === null &&
        repMax === null &&
        weight === null &&
        oneRm === null &&
        distance === null &&
        logMode === null
    ) {
        await supabase
            .from('user_exercise_prefs')
            .delete()
            .eq('user_id', user.id)
            .eq('exercise_id', exerciseId);
    } else {
        check(
            await supabase.from('user_exercise_prefs').upsert(
                {
                    user_id: user.id,
                    exercise_id: exerciseId,
                    default_sets: sets,
                    default_rep_min: repMin,
                    default_rep_max: repMax,
                    default_weight: weight,
                    default_1rm: oneRm,
                    default_distance: distance,
                    default_log_mode: logMode,
                },
                { onConflict: 'user_id,exercise_id' },
            ),
            'save exercise default',
        );
    }
    revalidatePath('/exercises');
}

/** Quick "make this my working weight" from a day's exercise card — writes only
 *  `default_weight` on the user's pref row, leaving any saved sets/reps alone. */
export async function setExerciseDefaultWeight(input: {
    exerciseId: string;
    dayId: string;
    weight: number | null;
}) {
    const { supabase, user } = await requireUser();
    const weight =
        input.weight === null || Number.isNaN(input.weight)
            ? null
            : Math.max(0, input.weight);

    const { data: existing } = await supabase
        .from('user_exercise_prefs')
        .select('default_sets, default_rep_min, default_rep_max')
        .eq('user_id', user.id)
        .eq('exercise_id', input.exerciseId)
        .maybeSingle();

    // keep the est. 1RM in sync with the new working weight (Epley over the
    // exercise's rep range, or WORKING_REPS if none is set)
    const lo = existing?.default_rep_min;
    const hi = existing?.default_rep_max;
    const reps =
        lo != null && hi != null ? (lo + hi) / 2 : (lo ?? hi ?? WORKING_REPS);
    const oneRm =
        weight !== null && weight > 0 ? round5(epley1rm(weight, reps)) : null;

    if (
        weight === null &&
        !existing?.default_sets &&
        !existing?.default_rep_min &&
        !existing?.default_rep_max
    ) {
        await supabase
            .from('user_exercise_prefs')
            .delete()
            .eq('user_id', user.id)
            .eq('exercise_id', input.exerciseId);
    } else {
        check(
            await supabase.from('user_exercise_prefs').upsert(
                {
                    user_id: user.id,
                    exercise_id: input.exerciseId,
                    default_sets: existing?.default_sets ?? null,
                    default_rep_min: existing?.default_rep_min ?? null,
                    default_rep_max: existing?.default_rep_max ?? null,
                    default_weight: weight,
                    default_1rm: oneRm,
                },
                { onConflict: 'user_id,exercise_id' },
            ),
            'save default weight',
        );
    }
    revalidatePath(`/day/${input.dayId}`);
    revalidatePath('/exercises');
}

/** Duration slider commit for a time-based exercise — saves the picked
 *  duration as the user's personal default (reusing default_rep_min/max,
 *  same as target_rep_min/max, to mean "seconds" for time-based exercises). */
export async function setExerciseDefaultSeconds(input: {
    exerciseId: string;
    dayId: string;
    seconds: number;
}) {
    const { supabase, user } = await requireUser();
    const seconds = Math.max(1, Math.min(999, Math.round(input.seconds)));

    const { data: existing } = await supabase
        .from('user_exercise_prefs')
        .select('default_sets, default_weight, default_1rm')
        .eq('user_id', user.id)
        .eq('exercise_id', input.exerciseId)
        .maybeSingle();

    check(
        await supabase.from('user_exercise_prefs').upsert(
            {
                user_id: user.id,
                exercise_id: input.exerciseId,
                default_sets: existing?.default_sets ?? null,
                default_rep_min: seconds,
                default_rep_max: seconds,
                default_weight: existing?.default_weight ?? null,
                default_1rm: existing?.default_1rm ?? null,
            },
            { onConflict: 'user_id,exercise_id' },
        ),
        'save default duration',
    );
    revalidatePath(`/day/${input.dayId}`);
    revalidatePath('/exercises');
}

/** Same idea for a distance-based exercise's target distance. */
export async function setExerciseDefaultDistance(input: {
    exerciseId: string;
    dayId: string;
    distance: number;
}) {
    const { supabase, user } = await requireUser();
    const distance = Math.max(0, input.distance);

    const { data: existing } = await supabase
        .from('user_exercise_prefs')
        .select('default_sets')
        .eq('user_id', user.id)
        .eq('exercise_id', input.exerciseId)
        .maybeSingle();

    check(
        await supabase.from('user_exercise_prefs').upsert(
            {
                user_id: user.id,
                exercise_id: input.exerciseId,
                default_sets: existing?.default_sets ?? null,
                default_distance: distance,
            },
            { onConflict: 'user_id,exercise_id' },
        ),
        'save default distance',
    );
    revalidatePath(`/day/${input.dayId}`);
    revalidatePath('/exercises');
}

/** Per-session time-or-distance mode for a dual-measurement exercise
 *  (e.g. Farmer's Carry, a treadmill walk). */
export async function setLogMode(
    pdeId: string,
    dayId: string,
    mode: 'time' | 'distance',
) {
    const { supabase } = await requireUser();
    await supabase
        .from('planned_day_exercises')
        .update({ log_mode: mode })
        .eq('id', pdeId);
    revalidatePath(`/day/${dayId}`);
}

/** Per-user targets. On any day (personal or party) these are yours alone and
 *  never touch another member's numbers. */
export async function updateDayExerciseTarget(input: {
    pdeId: string;
    dayId: string;
    sets?: number;
    repMin?: number | null;
    repMax?: number | null;
    weight?: number | null;
    distance?: number | null;
}) {
    const { supabase, user } = await requireUser();

    const { data: existing } = await supabase
        .from('day_exercise_user_targets')
        .select(
            'target_sets, target_rep_min, target_rep_max, target_weight, target_distance',
        )
        .eq('planned_day_exercise_id', input.pdeId)
        .eq('user_id', user.id)
        .maybeSingle();

    check(
        await supabase.from('day_exercise_user_targets').upsert(
            {
                planned_day_exercise_id: input.pdeId,
                user_id: user.id,
                target_sets:
                    input.sets !== undefined
                        ? Math.max(1, Math.min(12, input.sets))
                        : (existing?.target_sets ?? null),
                target_rep_min:
                    input.repMin !== undefined
                        ? input.repMin
                        : (existing?.target_rep_min ?? null),
                target_rep_max:
                    input.repMax !== undefined
                        ? input.repMax
                        : (existing?.target_rep_max ?? null),
                target_weight:
                    input.weight !== undefined
                        ? input.weight
                        : (existing?.target_weight ?? null),
                target_distance:
                    input.distance !== undefined
                        ? input.distance
                        : (existing?.target_distance ?? null),
            },
            { onConflict: 'planned_day_exercise_id,user_id' },
        ),
        'update target',
    );
    revalidatePath(`/day/${input.dayId}`);
}

/** A day's exercises in order, each with the superset group it belongs to. */
async function loadDayOrder(
    supabase: Awaited<ReturnType<typeof createClient>>,
    dayId: string,
) {
    const { data } = await supabase
        .from('planned_day_exercises')
        .select('id, sort, superset_group, created_at')
        .eq('planned_day_id', dayId)
        .order('sort')
        .order('created_at');
    return (data ?? []).map(r => ({
        id: r.id,
        sort: r.sort,
        group: r.superset_group,
    }));
}

/** Write back a new order / grouping, touching only the rows that changed.
 *  Every sort is rewritten to its 0..n-1 index so equal or gapped values can't
 *  make a move a no-op. */
async function saveDayOrder(
    supabase: Awaited<ReturnType<typeof createClient>>,
    before: { id: string; sort: number; group: number | null }[],
    after: { id: string; group: number | null }[],
) {
    await Promise.all(
        after.flatMap((r, idx) => {
            const prev = before.find(b => b.id === r.id);
            if (prev && prev.sort === idx && prev.group === r.group) return [];
            return [
                supabase
                    .from('planned_day_exercises')
                    .update({ sort: idx, superset_group: r.group })
                    .eq('id', r.id),
            ];
        }),
    );
}

/** Move one exercise up or down. Supersets stay intact: inside one it reorders
 *  within it, and at its edge the whole superset moves (see lib/supersets). */
export async function reorderDayExercise(
    pdeId: string,
    dayId: string,
    dir: -1 | 1,
) {
    const { supabase } = await requireUser();
    const rows = await loadDayOrder(supabase, dayId);
    const i = rows.findIndex(r => r.id === pdeId);
    if (i < 0) return;
    await saveDayOrder(supabase, rows, moveItem(rows, i, dir));
    revalidatePath(`/day/${dayId}`);
}

export async function removeDayExercise(pdeId: string, dayId: string) {
    const { supabase } = await requireUser();
    await supabase.from('planned_day_exercises').delete().eq('id', pdeId);
    // a superset left with a single exercise isn't one any more
    const rows = await loadDayOrder(supabase, dayId);
    await saveDayOrder(supabase, rows, normalizeGroups(rows));
    revalidatePath(`/day/${dayId}`);
}

/** Make the given exercises of a day a superset: gathered next to each other
 *  (at the first one's place) and outlined together. */
export async function makeDaySuperset(dayId: string, pdeIds: string[]) {
    const { supabase } = await requireUser();
    const rows = await loadDayOrder(supabase, dayId);
    const picked = new Set(pdeIds);
    const selected = new Set(
        rows.flatMap((r, i) => (picked.has(r.id) ? [i] : [])),
    );
    await saveDayOrder(supabase, rows, makeSuperset(rows, selected));
    revalidatePath(`/day/${dayId}`);
}

/** Take the given exercises of a day out of their supersets. */
export async function removeFromDaySuperset(dayId: string, pdeIds: string[]) {
    const { supabase } = await requireUser();
    const rows = await loadDayOrder(supabase, dayId);
    const picked = new Set(pdeIds);
    const selected = new Set(
        rows.flatMap((r, i) => (picked.has(r.id) ? [i] : [])),
    );
    await saveDayOrder(supabase, rows, ungroup(rows, selected));
    revalidatePath(`/day/${dayId}`);
}

/** Hot-swap this slot to a different catalog exercise (e.g. Lying Leg Curl ->
 *  Seated Leg Curl). Blocked once anyone has logged a set for it this
 *  session, so history/PRs never end up mislabeled — unless `force` is set,
 *  which the personal owner, whoever added this slot, or (for a party day)
 *  any party member may use — party members are co-owners of a shared day's
 *  exercise list, same as the `pde_write` RLS policy already allows. Old
 *  targets are cleared since they were tuned for the exercise being
 *  replaced. */
export async function swapExercise(
    pdeId: string,
    dayId: string,
    newExerciseId: string,
    force = false,
) {
    const { supabase, user } = await requireUser();

    const { count } = await supabase
        .from('set_logs')
        .select('id', { count: 'exact', head: true })
        .eq('planned_day_exercise_id', pdeId);

    if (count && count > 0) {
        const blocked = "Can't swap — sets are already logged for this one.";
        if (!force) throw new Error(blocked);

        const { data: pde } = await supabase
            .from('planned_day_exercises')
            .select('added_by')
            .eq('id', pdeId)
            .maybeSingle();
        let allowed = pde?.added_by === user.id;

        if (!allowed) {
            const { data: day } = await supabase
                .from('planned_days')
                .select('owner_user, party_id')
                .eq('id', dayId)
                .maybeSingle();
            allowed = day?.owner_user === user.id;
            if (!allowed && day?.party_id) {
                const { data: isMember } = await supabase.rpc(
                    'is_party_member',
                    {
                        p_party: day.party_id,
                    },
                );
                allowed = isMember === true;
            }
        }
        if (!allowed) throw new Error(blocked);
    }

    check(
        await supabase
            .from('planned_day_exercises')
            .update({
                exercise_id: newExerciseId,
                target_sets: null,
                target_rep_min: null,
                target_rep_max: null,
                target_weight: null,
                target_distance: null,
                log_mode: null,
            })
            .eq('id', pdeId),
        'swap exercise',
    );
    await supabase
        .from('day_exercise_user_targets')
        .delete()
        .eq('planned_day_exercise_id', pdeId);
    revalidatePath(`/day/${dayId}`);
}

// ---------------------------------------------------------------------------
// set logging
// ---------------------------------------------------------------------------
export async function logSet(input: {
    pdeId: string;
    dayId: string;
    setNo: number;
    weight: number | null;
    reps: number | null;
    distance?: number | null;
}) {
    const { supabase, user } = await requireUser();
    const distance = input.distance ?? null;

    if (input.weight === null && input.reps === null && distance === null) {
        await supabase
            .from('set_logs')
            .delete()
            .eq('planned_day_exercise_id', input.pdeId)
            .eq('user_id', user.id)
            .eq('set_no', input.setNo);
    } else {
        await supabase.from('set_logs').upsert(
            {
                planned_day_exercise_id: input.pdeId,
                user_id: user.id,
                set_no: input.setNo,
                weight: input.weight,
                reps: input.reps,
                distance,
            },
            { onConflict: 'planned_day_exercise_id,user_id,set_no' },
        );
    }

    // On a 1RM day a logged single is a max attempt: remember the heaviest one
    // as this lift's 1RM.
    if (input.reps === 1) {
        await saveOneRepMax(supabase, user.id, input.dayId, input.pdeId);
    }
    revalidatePath(`/day/${input.dayId}`);
}

/** On a 1RM day, your heaviest single (a set of exactly 1 rep) on an exercise
 *  becomes its saved 1RM — what the Exercises tab shows as "est. 1RM". Leaves
 *  the member's other saved defaults for that exercise alone. */
async function saveOneRepMax(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    dayId: string,
    pdeId: string,
) {
    const { data: day } = await supabase
        .from('planned_days')
        .select('category')
        .eq('id', dayId)
        .maybeSingle();
    if (day?.category !== 'one_rm') return;

    const [{ data: pde }, { data: singles }] = await Promise.all([
        supabase
            .from('planned_day_exercises')
            .select('exercise_id')
            .eq('id', pdeId)
            .maybeSingle(),
        supabase
            .from('set_logs')
            .select('weight')
            .eq('planned_day_exercise_id', pdeId)
            .eq('user_id', userId)
            .eq('reps', 1)
            .not('weight', 'is', null),
    ]);
    const best = Math.max(0, ...(singles ?? []).map(s => s.weight ?? 0));
    if (!pde || best <= 0) return;

    const { data: existing } = await supabase
        .from('user_exercise_prefs')
        .select('exercise_id')
        .eq('user_id', userId)
        .eq('exercise_id', pde.exercise_id)
        .maybeSingle();
    if (existing) {
        await supabase
            .from('user_exercise_prefs')
            .update({ default_1rm: best })
            .eq('user_id', userId)
            .eq('exercise_id', pde.exercise_id);
    } else {
        await supabase.from('user_exercise_prefs').insert({
            user_id: userId,
            exercise_id: pde.exercise_id,
            default_1rm: best,
        });
    }
    revalidatePath('/exercises');
}

// ---------------------------------------------------------------------------
// bodyweight
// ---------------------------------------------------------------------------
export async function logBodyweight(formData: FormData) {
    const { supabase, user } = await requireUser();
    const date = String(formData.get('date'));
    const weight = Number(formData.get('weight'));
    const note = String(formData.get('note') || '') || null;
    if (!date || !weight) return;
    await supabase
        .from('bodyweight_logs')
        .upsert(
            { user_id: user.id, date, weight, note },
            { onConflict: 'user_id,date' },
        );
    revalidatePath('/progress');
}

// ---------------------------------------------------------------------------
// parties
// ---------------------------------------------------------------------------
function randomCode() {
    return Array.from(
        { length: 6 },
        () =>
            'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)],
    ).join('');
}

export async function createParty(formData: FormData) {
    const { supabase, user } = await requireUser();
    const name = String(formData.get('name') || '').trim() || 'My Party';

    const { data: party } = await supabase
        .from('parties')
        .insert({ name, created_by: user.id })
        .select('id')
        .single();
    if (!party) redirect('/parties');

    await supabase.from('party_invites').insert({
        party_id: party.id,
        code: randomCode(),
        created_by: user.id,
    });

    redirect(`/parties/${party.id}`);
}

export async function joinParty(formData: FormData) {
    const { supabase } = await requireUser();
    const code = String(formData.get('code') || '')
        .trim()
        .toUpperCase();
    if (!code) redirect('/parties');
    const { data, error } = await supabase.rpc('join_party_with_code', {
        p_code: code,
    });
    if (error || !data) redirect('/parties?error=join');
    redirect(`/parties/${data}`);
}

export async function createPartyDay(formData: FormData) {
    const { supabase, user } = await requireUser();
    const partyId = String(formData.get('party_id'));
    const date = String(formData.get('date'));
    const category = String(formData.get('category') || '') as
        | Enums<'muscle_category'>
        | '';
    if (!partyId || !date) redirect('/parties');

    const { data: created } = await supabase
        .from('planned_days')
        .insert({
            party_id: partyId,
            date,
            category: category || null,
            created_by: user.id,
        })
        .select('id')
        .single();
    if (created) redirect(`/day/${created.id}`);
    redirect(`/parties/${partyId}`);
}

export async function deleteParty(partyId: string) {
    const { supabase } = await requireUser();
    // RLS party_delete = is_party_owner; cascades to members/invites/party days
    check(
        await supabase.from('parties').delete().eq('id', partyId),
        'delete party',
    );
    redirect('/parties');
}

export async function leaveParty(partyId: string) {
    const { supabase, user } = await requireUser();
    await supabase
        .from('party_members')
        .delete()
        .eq('party_id', partyId)
        .eq('user_id', user.id);
    redirect('/parties');
}

export async function renameParty(formData: FormData) {
    const { supabase } = await requireUser();
    const partyId = String(formData.get('party_id'));
    const name = String(formData.get('name') || '').trim();
    if (!name) return;
    check(
        await supabase.from('parties').update({ name }).eq('id', partyId),
        'rename party',
    );
    revalidatePath(`/parties/${partyId}`);
}

// ---------------------------------------------------------------------------
// admin: split preset editor
// ---------------------------------------------------------------------------
async function requireAdmin() {
    const { supabase, user } = await requireUser();
    if (!(await isAdmin(supabase))) throw new Error('Admins only');
    return { supabase, user };
}

export async function createSplitTemplate(formData: FormData) {
    const { supabase, user } = await requireAdmin();
    const name = String(formData.get('name') || '').trim();
    if (!name) return;
    const { data: t } = await supabase
        .from('schedule_templates')
        .insert({ name, is_global: true, created_by: user.id })
        .select('id')
        .single();
    if (t) {
        await supabase.from('template_days').insert(
            Array.from({ length: 7 }, (_, i) => ({
                template_id: t.id,
                position: i,
                weekday: i,
                category: 'rest' as Enums<'muscle_category'>,
                label: 'Rest',
            })),
        );
    }
    revalidatePath('/admin/splits');
}

export async function updateSplitTemplate(formData: FormData) {
    const { supabase } = await requireAdmin();
    const id = String(formData.get('template_id'));
    const name = String(formData.get('name') || '').trim();
    const description =
        String(formData.get('description') || '').trim() || null;
    const weeks = Number(formData.get('default_weeks')) || 8;
    if (!id || !name) return;
    check(
        await supabase
            .from('schedule_templates')
            .update({
                name,
                description,
                default_weeks: Math.max(1, Math.min(16, weeks)),
            })
            .eq('id', id),
        'update split',
    );
    revalidatePath('/admin/splits');
}

export async function deleteSplitTemplate(formData: FormData) {
    const { supabase } = await requireAdmin();
    await supabase
        .from('schedule_templates')
        .delete()
        .eq('id', String(formData.get('template_id')));
    revalidatePath('/admin/splits');
}

const catLabelFor = (c: Enums<'muscle_category'>) =>
    c === 'full_body'
        ? 'Full Body'
        : c === 'rest'
          ? 'Rest'
          : c.charAt(0).toUpperCase() + c.slice(1);

export async function saveSplitSlots(formData: FormData) {
    const { supabase } = await requireAdmin();
    const templateId = String(formData.get('template_id'));
    if (!templateId) return;
    const rows = Array.from({ length: 7 }, (_, i) => {
        const cat = String(
            formData.get(`slot_${i}`) || 'rest',
        ) as Enums<'muscle_category'>;
        return {
            template_id: templateId,
            position: i,
            weekday: i,
            category: cat,
            label: catLabelFor(cat),
        };
    });
    check(
        await supabase
            .from('template_days')
            .upsert(rows, { onConflict: 'template_id,position' }),
        'save split pattern',
    );
    revalidatePath('/admin/splits');
}

export async function addSplitExercise(formData: FormData) {
    const { supabase } = await requireAdmin();
    const templateDayId = String(formData.get('template_day_id'));
    const exerciseId = String(formData.get('exercise_id'));
    if (!templateDayId || !exerciseId) return;
    const { data: maxRow } = await supabase
        .from('template_day_exercises')
        .select('sort')
        .eq('template_day_id', templateDayId)
        .order('sort', { ascending: false })
        .limit(1)
        .maybeSingle();
    const { data: ex } = await supabase
        .from('exercises')
        .select('default_sets, default_rep_min, default_rep_max')
        .eq('id', exerciseId)
        .single();
    check(
        await supabase.from('template_day_exercises').insert({
            template_day_id: templateDayId,
            exercise_id: exerciseId,
            sort: (maxRow?.sort ?? -1) + 1,
            // null = "nothing set here", resolved to the exercise's catalog default
            // (then the viewer's goal suggestion) when a day is materialized/viewed
            sets: ex?.default_sets ?? null,
            rep_min: ex?.default_rep_min ?? null,
            rep_max: ex?.default_rep_max ?? null,
        }),
        'add split exercise',
    );
    revalidatePath('/admin/splits');
}

export async function updateSplitExercise(formData: FormData) {
    const { supabase } = await requireAdmin();
    const id = String(formData.get('tde_id'));
    const n = (k: string) => {
        const v = formData.get(k);
        return v === null || v === ''
            ? null
            : Math.max(1, Math.min(999, Number(v)));
    };
    check(
        await supabase
            .from('template_day_exercises')
            .update({
                sets: n('sets'),
                rep_min: n('rep_min'),
                rep_max: n('rep_max'),
            })
            .eq('id', id),
        'update split exercise',
    );
    revalidatePath('/admin/splits');
}

export async function removeSplitExercise(formData: FormData) {
    const { supabase } = await requireAdmin();
    await supabase
        .from('template_day_exercises')
        .delete()
        .eq('id', String(formData.get('tde_id')));
    revalidatePath('/admin/splits');
}

export async function reorderSplitExercise(formData: FormData) {
    const { supabase } = await requireAdmin();
    const tdeId = String(formData.get('tde_id'));
    const templateDayId = String(formData.get('template_day_id'));
    const dir = Number(formData.get('dir')) as -1 | 1;
    const { data: rows } = await supabase
        .from('template_day_exercises')
        .select('id, sort')
        .eq('template_day_id', templateDayId)
        .order('sort')
        .order('id');
    if (!rows) return;
    const i = rows.findIndex(r => r.id === tdeId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const [moved] = rows.splice(i, 1);
    rows.splice(j, 0, moved);
    await Promise.all(
        rows.map((r, idx) =>
            r.sort === idx
                ? Promise.resolve()
                : supabase
                      .from('template_day_exercises')
                      .update({ sort: idx })
                      .eq('id', r.id),
        ),
    );
    revalidatePath('/admin/splits');
}

// ---------------------------------------------------------------------------
// programs: admin-built multi-day plans a member loads from a start date
// ---------------------------------------------------------------------------
function revalidatePrograms(programId?: string) {
    revalidatePath('/programs');
    revalidatePath('/');
    if (programId) revalidatePath(`/programs/${programId}`);
}

function chunk<T>(items: T[], size = 400): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size)
        out.push(items.slice(i, i + size));
    return out;
}

/** Create a program, or replace an existing one's days wholesale. Days already
 *  planned from it are copies, so they're untouched. */
export async function saveProgram(
    input: ProgramInput,
): Promise<{ id: string }> {
    const { supabase, user } = await requireAdmin();

    const name = input.name.trim();
    if (!name) throw new Error('Give the program a name.');
    if (!input.days.some(d => !d.isRest && d.exercises.length > 0)) {
        throw new Error('Add at least one training day with an exercise.');
    }
    const unit: DurationUnit = input.durationUnit === 'days' ? 'days' : 'weeks';
    const meta = {
        name,
        description: input.description.trim() || null,
        duration_unit: unit,
        duration_count: clampDuration(unit, input.durationCount),
        difficulty: parseDifficulty(input.difficulty),
    };

    let programId = input.id;
    if (programId) {
        check(
            await supabase.from('programs').update(meta).eq('id', programId),
            'update program',
        );
        // cascades to the old days' exercises
        check(
            await supabase
                .from('program_days')
                .delete()
                .eq('program_id', programId),
            'clear program days',
        );
    } else {
        const { data: created, error } = await supabase
            .from('programs')
            .insert({ ...meta, created_by: user.id })
            .select('id')
            .single();
        if (error || !created)
            throw new Error(`create program: ${error?.message}`);
        programId = created.id;
    }

    const { data: days, error: dayErr } = await supabase
        .from('program_days')
        .insert(
            input.days.map((d, position) => ({
                program_id: programId!,
                position,
                // the "Day N" number comes from where a day lands on the calendar, so a
                // blank name just falls back to a plain label
                name: d.name.trim() || (d.isRest ? 'Rest' : 'Training day'),
                is_rest: d.isRest,
            })),
        )
        .select('id, position');
    if (dayErr || !days)
        throw new Error(`save program days: ${dayErr?.message}`);
    const idByPosition = new Map(days.map(d => [d.position, d.id]));

    const clamp = (n: number | null) =>
        n == null || Number.isNaN(n)
            ? null
            : Math.max(1, Math.min(999, Math.round(n)));
    const exerciseRows = input.days.flatMap((d, position) => {
        if (d.isRest) return [];
        // a superset needs at least two exercises, and its members sit together —
        // anything else is stored as not being in one
        const groupSizes = new Map<number, number>();
        d.exercises.forEach(e => {
            if (e.supersetGroup != null)
                groupSizes.set(
                    e.supersetGroup,
                    (groupSizes.get(e.supersetGroup) ?? 0) + 1,
                );
        });
        return d.exercises.map((e, sort) => {
            // a range for each set; rep_min / rep_max keep the overall range
            // (lowest min, highest max) for everything that wants just one
            const setReps = e.setReps.map(r => {
                let min = clamp(r.min);
                let max = clamp(r.max);
                if (min !== null && max !== null && min > max)
                    [min, max] = [max, min];
                return { min, max };
            });
            const overall = summarizeSetReps(setReps);
            const hasReps = setReps.some(r => r.min !== null || r.max !== null);
            const inSuperset =
                e.supersetGroup != null &&
                (groupSizes.get(e.supersetGroup) ?? 0) >= 2;
            return {
                program_day_id: idByPosition.get(position)!,
                exercise_id: e.exerciseId,
                sort,
                sets: clamp(e.sets),
                rep_min: overall.min,
                rep_max: overall.max,
                set_reps: hasReps ? setReps : null,
                superset_group: inSuperset ? e.supersetGroup : null,
            };
        });
    });
    for (const part of chunk(exerciseRows)) {
        check(
            await supabase.from('program_exercises').insert(part),
            'save program exercises',
        );
    }

    revalidatePrograms(programId);
    return { id: programId! };
}

export async function deleteProgram(formData: FormData) {
    const { supabase } = await requireAdmin();
    const id = String(formData.get('program_id'));
    if (!id) return;
    // days already planned from it keep their exercises — they were copied
    check(
        await supabase.from('programs').delete().eq('id', id),
        'delete program',
    );
    revalidatePrograms();
}

/** Load a program onto the calendar: its day list repeats on consecutive dates
 *  from the start date until the duration is filled, with a planned day (and its
 *  exercises) for every training day and nothing for rest days. */
export async function startProgram(formData: FormData) {
    const { supabase, user } = await requireUser();
    const programId = String(formData.get('program_id'));
    const start = String(formData.get('start_date'));
    // set when started from a party: the days become shared party days
    const partyId = String(formData.get('party_id') || '');
    if (!programId || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
    if (partyId) {
        const { data: isMember } = await supabase.rpc('is_party_member', {
            p_party: partyId,
        });
        if (isMember !== true) return;
    }

    const { data: program } = await supabase
        .from('programs')
        .select(
            'id, duration_unit, duration_count, program_days(id, position, name, is_rest, program_exercises(exercise_id, sort, sets, rep_min, rep_max, set_reps, superset_group, exercises(default_sets, default_rep_min, default_rep_max)))',
        )
        .eq('id', programId)
        .maybeSingle();
    if (!program) return;
    const days = [...program.program_days].sort(
        (a, b) => a.position - b.position,
    );
    if (days.length === 0) return;

    const unit: DurationUnit =
        program.duration_unit === 'days' ? 'days' : 'weeks';
    const total = programTotalDays(unit, program.duration_count);

    // `number` is the day's place in the program counting rest days, so a Tuesday
    // that's the third day of the program reads "Day 3" on the calendar
    const plan: { date: string; number: number; day: (typeof days)[number] }[] =
        [];
    for (let i = 0; i < total; i++) {
        const day = days[i % days.length];
        if (!day.is_rest)
            plan.push({ date: addDays(start, i), number: i + 1, day });
    }

    // one planned day per training date (a date appears once in the plan)
    const dayIdByDate = new Map<string, string>();
    for (const part of chunk(plan)) {
        const { data: created, error } = await supabase
            .from('planned_days')
            .insert(
                part.map(p => ({
                    // a party's days belong to the party (no owner), personal
                    // ones to the member
                    ...(partyId
                        ? { party_id: partyId, owner_user: null }
                        : { owner_user: user.id }),
                    date: p.date,
                    category: null,
                    label: p.day.name,
                    program_id: programId,
                    program_day_number: p.number,
                    created_by: user.id,
                })),
            )
            .select('id, date');
        if (error) throw new Error(`plan program days: ${error.message}`);
        for (const c of created ?? []) dayIdByDate.set(c.date, c.id);
    }

    // copy each program day's exercises onto the dates it lands on. They're
    // flagged from_program so the day page locks their sets and reps for the
    // member following along.
    type Seed = {
        planned_day_id: string;
        exercise_id: string;
        sort: number;
        target_sets: number;
        target_rep_min: number | null;
        target_rep_max: number | null;
        target_weight: null;
        from_program: true;
        /** each set's own rep range, stated on the day page (null = none given) */
        program_set_reps: { min: number | null; max: number | null }[] | null;
        /** exercises sharing a number are a superset (shown with a gold outline) */
        superset_group: number | null;
        added_by: string;
    };
    const seeds: Seed[] = [];
    const peByDayExercise = new Map<
        string,
        { sets: number | null; rep_min: number | null; rep_max: number | null }
    >();
    for (const p of plan) {
        const plannedId = dayIdByDate.get(p.date);
        if (!plannedId) continue;
        const exercises = [...p.day.program_exercises].sort(
            (a, b) => a.sort - b.sort,
        );
        exercises.forEach((e, j) => {
            peByDayExercise.set(`${plannedId}:${e.exercise_id}`, e);
            seeds.push({
                planned_day_id: plannedId,
                exercise_id: e.exercise_id,
                sort: j,
                target_sets:
                    e.sets ?? e.exercises?.default_sets ?? DEFAULT_SETS,
                target_rep_min:
                    e.rep_min ?? e.exercises?.default_rep_min ?? null,
                target_rep_max:
                    e.rep_max ?? e.exercises?.default_rep_max ?? null,
                target_weight: null,
                from_program: true,
                program_set_reps: parseSetReps(e.set_reps).length
                    ? parseSetReps(e.set_reps)
                    : null,
                superset_group: e.superset_group,
                added_by: user.id,
            });
        });
    }

    const mine: {
        planned_day_exercise_id: string;
        user_id: string;
        target_sets: number | null;
        target_rep_min: number | null;
        target_rep_max: number | null;
    }[] = [];
    for (const part of chunk(seeds)) {
        const { data: created, error } = await supabase
            .from('planned_day_exercises')
            .insert(part)
            .select('id, planned_day_id, exercise_id');
        if (error) throw new Error(`plan program exercises: ${error.message}`);
        for (const c of created ?? []) {
            const e = peByDayExercise.get(
                `${c.planned_day_id}:${c.exercise_id}`,
            );
            // the loader's own targets win over a personal exercise default, so the
            // program's numbers are what they see; blanks fall through as usual
            if (
                e &&
                (e.sets != null || e.rep_min != null || e.rep_max != null)
            ) {
                mine.push({
                    planned_day_exercise_id: c.id,
                    user_id: user.id,
                    target_sets: e.sets,
                    target_rep_min: e.rep_min,
                    target_rep_max: e.rep_max,
                });
            }
        }
    }
    for (const part of chunk(mine)) {
        await supabase
            .from('day_exercise_user_targets')
            .upsert(part, { onConflict: 'planned_day_exercise_id,user_id' });
    }

    // Following a program (and its Stop / repeat prompts) is a personal thing;
    // a party's days are just shared days, taken off one at a time.
    if (!partyId) {
        check(
            await supabase.from('user_programs').upsert(
                {
                    user_id: user.id,
                    program_id: programId,
                    start_date: start,
                    end_date: programEndDate(
                        start,
                        unit,
                        program.duration_count,
                    ),
                },
                { onConflict: 'user_id' },
            ),
            'start program',
        );
    }

    revalidatePath('/');
    revalidatePath('/programs');
    if (partyId) {
        revalidatePath(`/parties/${partyId}`);
        redirect(`/parties/${partyId}`);
    }
    redirect(`/?week=${start}`);
}

/** Stop following the current program. Every day it put on the calendar comes
 *  off — past and upcoming — except the ones you've logged sets on, which stay
 *  as history. Once a program has already finished there's nothing to take off:
 *  this just clears it (that's how the end-of-program prompt is dismissed). */
export async function stopProgram(): Promise<{ removedDayIds: string[] }> {
    const { supabase, user } = await requireUser();
    const { data: run } = await supabase
        .from('user_programs')
        .select('program_id, start_date, end_date')
        .eq('user_id', user.id)
        .maybeSingle();

    // returned so the browser can forget a "resume session" pointing at a day
    // that no longer exists
    const removedDayIds: string[] = [];

    if (run && run.end_date >= (await getUserToday())) {
        // only this run's days, not an earlier run of the same program
        const { data: days } = await supabase
            .from('planned_days')
            .select('id, planned_day_exercises(id, set_logs(id))')
            .eq('owner_user', user.id)
            .eq('program_id', run.program_id)
            .gte('date', run.start_date)
            .lte('date', run.end_date);
        const removable = (days ?? [])
            .filter(d =>
                d.planned_day_exercises.every(e => e.set_logs.length === 0),
            )
            .map(d => d.id);
        for (const part of chunk(removable)) {
            await supabase.from('planned_days').delete().in('id', part);
        }
        removedDayIds.push(...removable);
    }

    await supabase.from('user_programs').delete().eq('user_id', user.id);
    revalidatePath('/');
    revalidatePath('/programs');
    return { removedDayIds };
}
