"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/date";
import {
  DEFAULT_SETS,
  isCompound,
  recommendedReps,
  type Goal,
} from "@/lib/targets";
import { isAdmin, notifyExerciseRequest } from "@/lib/admin";
import type { Enums } from "@/lib/supabase/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Throw (instead of silently no-op) when a Supabase write fails. */
function check(
  { error }: { error: { message: string } | null },
  what: string,
) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// onboarding
// ---------------------------------------------------------------------------
export async function saveOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();

  const displayName = String(formData.get("display_name") || "").trim();
  const units = (String(formData.get("units")) as Enums<"unit_system">) || "lb";
  const experience = String(formData.get("experience") || "") as
    | Enums<"experience_level">
    | "";
  const primaryGoal = String(formData.get("primary_goal") || "");
  const focusMuscles = formData.getAll("focus_muscles").map(String) as Enums<"muscle_group">[];
  const num = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : Number(v);
  };

  check(
    await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        units,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", user.id),
    "save profile",
  );

  check(
    await supabase
      .from("user_constants")
      .update({
        experience: experience || null,
        primary_goal: primaryGoal || null,
        focus_muscles: focusMuscles,
        current_bodyweight: num("current_bodyweight"),
        target_bodyweight: num("target_bodyweight"),
        weekly_gain_target: num("weekly_gain_target"),
      })
      .eq("user_id", user.id),
    "save constants",
  );

  const templateId = String(formData.get("template_id") || "");
  if (templateId && templateId !== "none") {
    const t = await loadTemplate(supabase, templateId);
    if (t) {
      await materializeSplit(supabase, user.id, {
        slots: t.slots,
        exercisesByCategory: t.exercisesByCategory,
        weeks: t.defaultWeeks,
      });
    }
  }

  redirect("/");
}

// ---------------------------------------------------------------------------
// account — edit onboarding answers later
// ---------------------------------------------------------------------------
export async function updateAccount(formData: FormData) {
  const { supabase, user } = await requireUser();

  const displayName = String(formData.get("display_name") || "").trim();
  const units = (String(formData.get("units")) as Enums<"unit_system">) || "lb";
  const experience = String(formData.get("experience") || "") as
    | Enums<"experience_level">
    | "";
  const primaryGoal = String(formData.get("primary_goal") || "");
  const focusMuscles = formData.getAll("focus_muscles").map(String) as Enums<"muscle_group">[];
  const num = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : Number(v);
  };

  check(
    await supabase
      .from("profiles")
      .update({ display_name: displayName || null, units })
      .eq("id", user.id),
    "update profile",
  );

  check(
    await supabase
      .from("user_constants")
      .update({
        experience: experience || null,
        primary_goal: primaryGoal || null,
        focus_muscles: focusMuscles,
        current_bodyweight: num("current_bodyweight"),
        target_bodyweight: num("target_bodyweight"),
        weekly_gain_target: num("weekly_gain_target"),
      })
      .eq("user_id", user.id),
    "update constants",
  );

  revalidatePath("/account");
}

export async function updateTimezone(formData: FormData) {
  const { supabase, user } = await requireUser();
  const tz = String(formData.get("timezone") || "").trim();
  if (!tz) return;
  // sanity-check it's a real IANA zone
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    return;
  }
  check(
    await supabase.from("profiles").update({ timezone: tz }).eq("id", user.id),
    "update timezone",
  );
  revalidatePath("/account");
  revalidatePath("/");
}

/** Delete every solo planned day from today forward (before re-applying a template). */
export async function clearUpcomingCalendar() {
  const { supabase, user } = await requireUser();
  const todayISO = new Date().toISOString().slice(0, 10);
  check(
    await supabase
      .from("planned_days")
      .delete()
      .eq("owner_user", user.id)
      .gte("date", todayISO),
    "clear calendar",
  );
  revalidatePath("/");
  revalidatePath("/account");
}

// ---------------------------------------------------------------------------
// templates / splits
// ---------------------------------------------------------------------------
type Cat = Enums<"muscle_category">;
type ExRow = {
  exercise_id: string;
  sort: number;
  sets: number | null;
  rep_min: number | null;
  rep_max: number | null;
};

const LABEL: Partial<Record<Cat, string>> = { full_body: "Full Body", rest: "Rest" };
const catLabel = (c: Cat) =>
  LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1);

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

  // the user's saved per-exercise defaults override the template's numbers
  const { data: prefRows } = await supabase
    .from("user_exercise_prefs")
    .select("exercise_id, default_sets, default_rep_min, default_rep_max, default_weight")
    .eq("user_id", userId);
  const prefs = new Map((prefRows ?? []).map((p) => [p.exercise_id, p]));

  for (let w = 0; w < opts.weeks; w++) {
    for (let pos = 0; pos < opts.slots.length; pos++) {
      const cat = opts.slots[pos];
      if (!cat || cat === "rest") continue;
      const date = addDays(start, w * 7 + pos);

      const { data: day } = await supabase
        .from("planned_days")
        .insert({
          owner_user: userId,
          date,
          category: cat,
          label: catLabel(cat),
          created_by: userId,
        })
        .select("id")
        .single();
      if (!day) continue;

      const exs = opts.exercisesByCategory.get(cat) ?? [];
      if (exs.length) {
        await supabase.from("planned_day_exercises").insert(
          exs.map((e) => {
            const pref = prefs.get(e.exercise_id);
            return {
              planned_day_id: day.id,
              exercise_id: e.exercise_id,
              sort: e.sort,
              target_sets: pref?.default_sets ?? DEFAULT_SETS,
              target_rep_min: pref?.default_rep_min ?? e.rep_min,
              target_rep_max: pref?.default_rep_max ?? e.rep_max,
              target_weight: pref?.default_weight ?? null,
              added_by: userId,
            };
          }),
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
    .from("schedule_templates")
    .select(
      "default_weeks, template_days(position, category, template_day_exercises(exercise_id, sort, sets, rep_min, rep_max))",
    )
    .eq("id", templateId)
    .single();
  if (!tmpl) return null;

  const slots: (Cat | null)[] = Array(7).fill(null);
  const exercisesByCategory = new Map<Cat, ExRow[]>();
  for (const td of tmpl.template_days) {
    if (td.position >= 0 && td.position < 7) slots[td.position] = td.category;
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
  const templateId = String(formData.get("template_id"));
  const t = await loadTemplate(supabase, templateId);
  if (!t) redirect("/account");

  await materializeSplit(supabase, user.id, {
    slots: t.slots,
    exercisesByCategory: t.exercisesByCategory,
    fromDate: String(formData.get("from_date") || "") || undefined,
    weeks: formData.get("weeks") ? Number(formData.get("weeks")) : t.defaultWeeks,
  });
  revalidatePath("/");
  redirect("/");
}

/** Apply a reordered / edited 7-slot split. `source_template_id` (optional)
 *  supplies the exercise lists per category. */
export async function applyCustomSplit(formData: FormData) {
  const { supabase, user } = await requireUser();

  const slots = Array.from({ length: 7 }, (_, i) => {
    const v = String(formData.get(`slot_${i}`) || "rest");
    return v === "rest" ? null : (v as Cat);
  });

  let exercisesByCategory = new Map<Cat, ExRow[]>();
  const sourceId = String(formData.get("source_template_id") || "");
  if (sourceId) {
    const t = await loadTemplate(supabase, sourceId);
    if (t) exercisesByCategory = t.exercisesByCategory;
  }

  await materializeSplit(supabase, user.id, {
    slots,
    exercisesByCategory,
    fromDate: String(formData.get("from_date") || "") || undefined,
    weeks: formData.get("weeks") ? Number(formData.get("weeks")) : 8,
  });
  revalidatePath("/");
  redirect("/");
}

// ---------------------------------------------------------------------------
// exercises
// ---------------------------------------------------------------------------
/** parse "chest, front delts, custom thing" -> ["chest","front_delts","custom thing"] */
function parseMuscles(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
}

function exerciseFieldsFromForm(formData: FormData) {
  const numOrNull = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : Math.max(1, Math.min(20, Number(v)));
  };
  return {
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category")) as Enums<"muscle_category">,
    primary_muscles: parseMuscles(String(formData.get("primary_muscles") || "")),
    secondary_muscles: parseMuscles(String(formData.get("secondary_muscles") || "")),
    howto_text: String(formData.get("howto_text") || "").trim() || null,
    media_url: String(formData.get("media_url") || "").trim() || null,
    default_sets: numOrNull("default_sets"),
    default_rep_min: numOrNull("default_rep_min"),
    default_rep_max: numOrNull("default_rep_max"),
  };
}

export async function createExercise(formData: FormData) {
  const { supabase, user } = await requireUser();
  if (!(await isAdmin(supabase))) throw new Error("Admins only");

  const fields = exerciseFieldsFromForm(formData);
  if (!fields.name || !fields.category) return;
  check(
    await supabase
      .from("exercises")
      .insert({ ...fields, created_by: user.id, is_public: true }),
    "create exercise",
  );

  const requestId = String(formData.get("request_id") || "");
  if (requestId) {
    await supabase
      .from("exercise_requests")
      .update({ status: "done" })
      .eq("id", requestId);
  }
  revalidatePath("/exercises");
}

export async function updateExercise(formData: FormData) {
  const { supabase } = await requireUser();
  if (!(await isAdmin(supabase))) throw new Error("Admins only");

  const id = String(formData.get("exercise_id"));
  const fields = exerciseFieldsFromForm(formData);
  if (!id || !fields.name || !fields.category) return;
  check(
    await supabase.from("exercises").update(fields).eq("id", id),
    "update exercise",
  );
  revalidatePath("/exercises");
}

export async function requestExercise(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;
  if (!name) return;

  check(
    await supabase
      .from("exercise_requests")
      .insert({ user_id: user.id, name, note }),
    "submit request",
  );
  await notifyExerciseRequest({ name, note, fromEmail: user.email ?? null });
  revalidatePath("/exercises");
}

export async function dismissExerciseRequest(formData: FormData) {
  const { supabase } = await requireUser();
  if (!(await isAdmin(supabase))) throw new Error("Admins only");
  await supabase
    .from("exercise_requests")
    .update({ status: "dismissed" })
    .eq("id", String(formData.get("request_id")));
  revalidatePath("/exercises");
}

export async function setExerciseArchived(formData: FormData) {
  const { supabase } = await requireUser();
  if (!(await isAdmin(supabase))) throw new Error("Admins only");
  const id = String(formData.get("exercise_id"));
  const archived = String(formData.get("archived")) === "true";
  check(
    await supabase
      .from("exercises")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id),
    "archive exercise",
  );
  revalidatePath("/exercises");
}

export async function deleteExercise(formData: FormData) {
  const { supabase } = await requireUser();
  if (!(await isAdmin(supabase))) throw new Error("Admins only");
  const id = String(formData.get("exercise_id"));

  const { count } = await supabase
    .from("planned_day_exercises")
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(
      "This exercise is on someone's planned day — archive it instead of deleting.",
    );
  }
  check(await supabase.from("exercises").delete().eq("id", id), "delete exercise");
  revalidatePath("/exercises");
}

// ---------------------------------------------------------------------------
// planned days
// ---------------------------------------------------------------------------
/** Always creates a new personal session on that date — a day can hold several
 *  (e.g. a party session and a solo session, or a 2-a-day). */
export async function createDay(formData: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(formData.get("date"));
  const category = String(formData.get("category") || "") as Enums<"muscle_category"> | "";
  if (!date) redirect("/");

  const { data: created } = await supabase
    .from("planned_days")
    .insert({
      owner_user: user.id,
      date,
      category: category || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (created) redirect(`/day/${created.id}`);
  redirect("/");
}

export async function setDayCategory(dayId: string, category: Enums<"muscle_category">) {
  const { supabase } = await requireUser();
  await supabase.from("planned_days").update({ category }).eq("id", dayId);
  revalidatePath(`/day/${dayId}`);
}

export async function deleteDay(dayId: string) {
  const { supabase } = await requireUser();
  const { data: day } = await supabase
    .from("planned_days")
    .select("party_id")
    .eq("id", dayId)
    .maybeSingle();
  await supabase.from("planned_days").delete().eq("id", dayId);
  redirect(day?.party_id ? `/parties/${day.party_id}` : "/");
}

export async function addExerciseToDay(dayId: string, exerciseId: string) {
  const { supabase, user } = await requireUser();

  const [{ data: ex }, { data: pref }, { data: constants }, { data: maxRow }] =
    await Promise.all([
      supabase
        .from("exercises")
        .select("name, primary_muscles, default_sets, default_rep_min, default_rep_max")
        .eq("id", exerciseId)
        .single(),
      supabase
        .from("user_exercise_prefs")
        .select("default_sets, default_rep_min, default_rep_max, default_weight")
        .eq("user_id", user.id)
        .eq("exercise_id", exerciseId)
        .maybeSingle(),
      supabase.from("user_constants").select("primary_goal").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("planned_day_exercises")
        .select("sort")
        .eq("planned_day_id", dayId)
        .order("sort", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const compound = ex ? isCompound(ex) : false;
  const [recMin, recMax] = recommendedReps(
    (constants?.primary_goal as Goal) ?? null,
    compound,
  );

  // seed on the shared row: adder's pref -> catalog default -> goal recommendation.
  // each member's own numbers are layered on at view time (day_exercise_user_targets).
  const { data: created } = await supabase
    .from("planned_day_exercises")
    .insert({
      planned_day_id: dayId,
      exercise_id: exerciseId,
      sort: (maxRow?.sort ?? -1) + 1,
      target_sets: pref?.default_sets ?? ex?.default_sets ?? DEFAULT_SETS,
      target_rep_min: pref?.default_rep_min ?? ex?.default_rep_min ?? recMin,
      target_rep_max: pref?.default_rep_max ?? ex?.default_rep_max ?? recMax,
      target_weight: pref?.default_weight ?? null,
      added_by: user.id,
    })
    .select("id")
    .single();

  // give the adder their own target row immediately from their prefs
  if (created && pref) {
    await supabase.from("day_exercise_user_targets").upsert(
      {
        planned_day_exercise_id: created.id,
        user_id: user.id,
        target_sets: pref.default_sets,
        target_rep_min: pref.default_rep_min,
        target_rep_max: pref.default_rep_max,
        target_weight: pref.default_weight,
      },
      { onConflict: "planned_day_exercise_id,user_id" },
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
  if (note === "") {
    await supabase
      .from("day_exercise_notes")
      .delete()
      .eq("planned_day_exercise_id", input.pdeId)
      .eq("user_id", user.id);
  } else {
    check(
      await supabase.from("day_exercise_notes").upsert(
        { planned_day_exercise_id: input.pdeId, user_id: user.id, note },
        { onConflict: "planned_day_exercise_id,user_id" },
      ),
      "save note",
    );
  }
  revalidatePath(`/day/${input.dayId}`);
}

// ---------------------------------------------------------------------------
// per-user exercise defaults (Exercises tab)
// ---------------------------------------------------------------------------
export async function setExercisePref(formData: FormData) {
  const { supabase, user } = await requireUser();
  const exerciseId = String(formData.get("exercise_id"));
  const n = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : Math.max(1, Math.min(20, Number(v)));
  };
  const sets = n("default_sets");
  const repMin = n("default_rep_min");
  const repMax = n("default_rep_max");
  const weightRaw = formData.get("default_weight");
  const weight =
    weightRaw === null || weightRaw === "" ? null : Math.max(0, Number(weightRaw));

  if (sets === null && repMin === null && repMax === null && weight === null) {
    await supabase
      .from("user_exercise_prefs")
      .delete()
      .eq("user_id", user.id)
      .eq("exercise_id", exerciseId);
  } else {
    check(
      await supabase.from("user_exercise_prefs").upsert(
        {
          user_id: user.id,
          exercise_id: exerciseId,
          default_sets: sets,
          default_rep_min: repMin,
          default_rep_max: repMax,
          default_weight: weight,
        },
        { onConflict: "user_id,exercise_id" },
      ),
      "save exercise default",
    );
  }
  revalidatePath("/exercises");
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
}) {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("day_exercise_user_targets")
    .select("target_sets, target_rep_min, target_rep_max, target_weight")
    .eq("planned_day_exercise_id", input.pdeId)
    .eq("user_id", user.id)
    .maybeSingle();

  check(
    await supabase.from("day_exercise_user_targets").upsert(
      {
        planned_day_exercise_id: input.pdeId,
        user_id: user.id,
        target_sets:
          input.sets !== undefined
            ? Math.max(1, Math.min(12, input.sets))
            : (existing?.target_sets ?? null),
        target_rep_min:
          input.repMin !== undefined ? input.repMin : (existing?.target_rep_min ?? null),
        target_rep_max:
          input.repMax !== undefined ? input.repMax : (existing?.target_rep_max ?? null),
        target_weight:
          input.weight !== undefined ? input.weight : (existing?.target_weight ?? null),
      },
      { onConflict: "planned_day_exercise_id,user_id" },
    ),
    "update target",
  );
  revalidatePath(`/day/${input.dayId}`);
}

export async function reorderDayExercise(pdeId: string, dayId: string, dir: -1 | 1) {
  const { supabase } = await requireUser();
  const { data: rows } = await supabase
    .from("planned_day_exercises")
    .select("id, sort, created_at")
    .eq("planned_day_id", dayId)
    .order("sort")
    .order("created_at");
  if (!rows) return;

  const i = rows.findIndex((r) => r.id === pdeId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;

  // move in the array, then rewrite every sort to its new 0..n-1 index so equal
  // or gapped sort values can't make a swap a no-op
  const [moved] = rows.splice(i, 1);
  rows.splice(j, 0, moved);
  await Promise.all(
    rows.map((r, idx) =>
      r.sort === idx
        ? Promise.resolve()
        : supabase.from("planned_day_exercises").update({ sort: idx }).eq("id", r.id),
    ),
  );
  revalidatePath(`/day/${dayId}`);
}

export async function removeDayExercise(pdeId: string, dayId: string) {
  const { supabase } = await requireUser();
  await supabase.from("planned_day_exercises").delete().eq("id", pdeId);
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
}) {
  const { supabase, user } = await requireUser();

  if (input.weight === null && input.reps === null) {
    await supabase
      .from("set_logs")
      .delete()
      .eq("planned_day_exercise_id", input.pdeId)
      .eq("user_id", user.id)
      .eq("set_no", input.setNo);
  } else {
    await supabase.from("set_logs").upsert(
      {
        planned_day_exercise_id: input.pdeId,
        user_id: user.id,
        set_no: input.setNo,
        weight: input.weight,
        reps: input.reps,
      },
      { onConflict: "planned_day_exercise_id,user_id,set_no" },
    );
  }
  revalidatePath(`/day/${input.dayId}`);
}

// ---------------------------------------------------------------------------
// bodyweight
// ---------------------------------------------------------------------------
export async function logBodyweight(formData: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(formData.get("date"));
  const weight = Number(formData.get("weight"));
  const note = String(formData.get("note") || "") || null;
  if (!date || !weight) return;
  await supabase
    .from("bodyweight_logs")
    .upsert({ user_id: user.id, date, weight, note }, { onConflict: "user_id,date" });
  revalidatePath("/progress");
}

// ---------------------------------------------------------------------------
// parties
// ---------------------------------------------------------------------------
function randomCode() {
  return Array.from({ length: 6 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)],
  ).join("");
}

export async function createParty(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") || "").trim() || "My Party";
  const inviteType = (String(formData.get("invite_type")) as Enums<"party_invite_type">) || "invite_only";

  const { data: party } = await supabase
    .from("parties")
    .insert({ name, invite_type: inviteType, created_by: user.id })
    .select("id")
    .single();
  if (!party) redirect("/parties");

  await supabase.from("party_invites").insert({
    party_id: party.id,
    code: randomCode(),
    created_by: user.id,
  });

  redirect(`/parties/${party.id}`);
}

export async function joinParty(formData: FormData) {
  const { supabase } = await requireUser();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!code) redirect("/parties");
  const { data, error } = await supabase.rpc("join_party_with_code", { p_code: code });
  if (error || !data) redirect("/parties?error=join");
  redirect(`/parties/${data}`);
}

export async function createPartyDay(formData: FormData) {
  const { supabase, user } = await requireUser();
  const partyId = String(formData.get("party_id"));
  const date = String(formData.get("date"));
  const category = String(formData.get("category") || "") as Enums<"muscle_category"> | "";
  if (!partyId || !date) redirect("/parties");

  const { data: created } = await supabase
    .from("planned_days")
    .insert({ party_id: partyId, date, category: category || null, created_by: user.id })
    .select("id")
    .single();
  if (created) redirect(`/day/${created.id}`);
  redirect(`/parties/${partyId}`);
}

export async function leaveParty(partyId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("party_members").delete().eq("party_id", partyId).eq("user_id", user.id);
  redirect("/parties");
}

export async function renameParty(formData: FormData) {
  const { supabase } = await requireUser();
  const partyId = String(formData.get("party_id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  check(
    await supabase.from("parties").update({ name }).eq("id", partyId),
    "rename party",
  );
  revalidatePath(`/parties/${partyId}`);
}

// ---------------------------------------------------------------------------
// admin: split preset editor
// ---------------------------------------------------------------------------
async function requireAdmin() {
  const { supabase, user } = await requireUser();
  if (!(await isAdmin(supabase))) throw new Error("Admins only");
  return { supabase, user };
}

export async function createSplitTemplate(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const { data: t } = await supabase
    .from("schedule_templates")
    .insert({ name, is_global: true, created_by: user.id })
    .select("id")
    .single();
  if (t) {
    await supabase.from("template_days").insert(
      Array.from({ length: 7 }, (_, i) => ({
        template_id: t.id,
        position: i,
        weekday: i,
        category: "rest" as Enums<"muscle_category">,
        label: "Rest",
      })),
    );
  }
  revalidatePath("/admin/splits");
}

export async function updateSplitTemplate(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("template_id"));
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const weeks = Number(formData.get("default_weeks")) || 8;
  if (!id || !name) return;
  check(
    await supabase
      .from("schedule_templates")
      .update({ name, description, default_weeks: Math.max(1, Math.min(16, weeks)) })
      .eq("id", id),
    "update split",
  );
  revalidatePath("/admin/splits");
}

export async function deleteSplitTemplate(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("schedule_templates")
    .delete()
    .eq("id", String(formData.get("template_id")));
  revalidatePath("/admin/splits");
}

const catLabelFor = (c: Enums<"muscle_category">) =>
  c === "full_body" ? "Full Body" : c === "rest" ? "Rest" : c.charAt(0).toUpperCase() + c.slice(1);

export async function saveSplitSlots(formData: FormData) {
  const { supabase } = await requireAdmin();
  const templateId = String(formData.get("template_id"));
  if (!templateId) return;
  const rows = Array.from({ length: 7 }, (_, i) => {
    const cat = String(formData.get(`slot_${i}`) || "rest") as Enums<"muscle_category">;
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
      .from("template_days")
      .upsert(rows, { onConflict: "template_id,position" }),
    "save split pattern",
  );
  revalidatePath("/admin/splits");
}

export async function addSplitExercise(formData: FormData) {
  const { supabase } = await requireAdmin();
  const templateDayId = String(formData.get("template_day_id"));
  const exerciseId = String(formData.get("exercise_id"));
  if (!templateDayId || !exerciseId) return;
  const { data: maxRow } = await supabase
    .from("template_day_exercises")
    .select("sort")
    .eq("template_day_id", templateDayId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: ex } = await supabase
    .from("exercises")
    .select("default_sets, default_rep_min, default_rep_max")
    .eq("id", exerciseId)
    .single();
  check(
    await supabase.from("template_day_exercises").insert({
      template_day_id: templateDayId,
      exercise_id: exerciseId,
      sort: (maxRow?.sort ?? -1) + 1,
      sets: ex?.default_sets ?? 3,
      rep_min: ex?.default_rep_min ?? 8,
      rep_max: ex?.default_rep_max ?? 12,
    }),
    "add split exercise",
  );
  revalidatePath("/admin/splits");
}

export async function updateSplitExercise(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("tde_id"));
  const n = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : Math.max(1, Math.min(20, Number(v)));
  };
  check(
    await supabase
      .from("template_day_exercises")
      .update({ sets: n("sets"), rep_min: n("rep_min"), rep_max: n("rep_max") })
      .eq("id", id),
    "update split exercise",
  );
  revalidatePath("/admin/splits");
}

export async function removeSplitExercise(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("template_day_exercises")
    .delete()
    .eq("id", String(formData.get("tde_id")));
  revalidatePath("/admin/splits");
}

export async function reorderSplitExercise(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tdeId = String(formData.get("tde_id"));
  const templateDayId = String(formData.get("template_day_id"));
  const dir = Number(formData.get("dir")) as -1 | 1;
  const { data: rows } = await supabase
    .from("template_day_exercises")
    .select("id, sort")
    .eq("template_day_id", templateDayId)
    .order("sort")
    .order("id");
  if (!rows) return;
  const i = rows.findIndex((r) => r.id === tdeId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  const [moved] = rows.splice(i, 1);
  rows.splice(j, 0, moved);
  await Promise.all(
    rows.map((r, idx) =>
      r.sort === idx
        ? Promise.resolve()
        : supabase.from("template_day_exercises").update({ sort: idx }).eq("id", r.id),
    ),
  );
  revalidatePath("/admin/splits");
}
