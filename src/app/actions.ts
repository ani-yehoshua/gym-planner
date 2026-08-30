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
          exs.map((e) => ({
            planned_day_id: day.id,
            exercise_id: e.exercise_id,
            sort: e.sort,
            target_sets: DEFAULT_SETS, // start everyone at 2; dial up toward the suggestion
            target_rep_min: e.rep_min,
            target_rep_max: e.rep_max,
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
export async function createExercise(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category")) as Enums<"muscle_category">;
  const primary = formData.getAll("primary_muscles").map(String) as Enums<"muscle_group">[];
  if (!name || !category) return;
  check(
    await supabase.from("exercises").insert({
      name,
      category,
      primary_muscles: primary,
      howto_text: String(formData.get("howto_text") || "") || null,
      media_url: String(formData.get("media_url") || "") || null,
      created_by: user.id,
      is_public: false,
    }),
    "create exercise",
  );
  revalidatePath("/exercises");
}

// ---------------------------------------------------------------------------
// planned days
// ---------------------------------------------------------------------------
export async function openOrCreateDay(formData: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(formData.get("date"));
  const category = String(formData.get("category") || "") as Enums<"muscle_category"> | "";

  const { data: existing } = await supabase
    .from("planned_days")
    .select("id")
    .eq("owner_user", user.id)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    if (category) {
      await supabase.from("planned_days").update({ category }).eq("id", existing.id);
    }
    redirect(`/day/${existing.id}`);
  }

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
  await supabase.from("planned_days").delete().eq("id", dayId);
  redirect("/");
}

export async function addExerciseToDay(dayId: string, exerciseId: string) {
  const { supabase, user } = await requireUser();

  const { data: ex } = await supabase
    .from("exercises")
    .select("name, primary_muscles")
    .eq("id", exerciseId)
    .single();
  const { data: constants } = await supabase
    .from("user_constants")
    .select("primary_goal")
    .eq("user_id", user.id)
    .maybeSingle();
  const { count } = await supabase
    .from("planned_day_exercises")
    .select("id", { count: "exact", head: true })
    .eq("planned_day_id", dayId);

  const compound = ex ? isCompound(ex) : false;
  const [repMin, repMax] = recommendedReps(
    (constants?.primary_goal as Goal) ?? null,
    compound,
  );

  check(
    await supabase.from("planned_day_exercises").insert({
      planned_day_id: dayId,
      exercise_id: exerciseId,
      sort: count ?? 0,
      target_sets: DEFAULT_SETS,
      target_rep_min: repMin,
      target_rep_max: repMax,
      added_by: user.id,
    }),
    "add exercise",
  );
  revalidatePath(`/day/${dayId}`);
}

export async function updateDayExerciseTarget(input: {
  pdeId: string;
  dayId: string;
  sets?: number;
  repMin?: number | null;
  repMax?: number | null;
}) {
  const { supabase } = await requireUser();
  const patch: {
    target_sets?: number;
    target_rep_min?: number | null;
    target_rep_max?: number | null;
  } = {};
  if (input.sets !== undefined) patch.target_sets = Math.max(1, Math.min(12, input.sets));
  if (input.repMin !== undefined) patch.target_rep_min = input.repMin;
  if (input.repMax !== undefined) patch.target_rep_max = input.repMax;
  check(
    await supabase.from("planned_day_exercises").update(patch).eq("id", input.pdeId),
    "update target",
  );
  revalidatePath(`/day/${input.dayId}`);
}

export async function reorderDayExercise(pdeId: string, dayId: string, dir: -1 | 1) {
  const { supabase } = await requireUser();
  const { data: rows } = await supabase
    .from("planned_day_exercises")
    .select("id, sort")
    .eq("planned_day_id", dayId)
    .order("sort");
  if (!rows) return;

  const i = rows.findIndex((r) => r.id === pdeId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;

  // swap sort values
  await supabase.from("planned_day_exercises").update({ sort: rows[j].sort }).eq("id", rows[i].id);
  await supabase.from("planned_day_exercises").update({ sort: rows[i].sort }).eq("id", rows[j].id);
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

  const { data: existing } = await supabase
    .from("planned_days")
    .select("id")
    .eq("party_id", partyId)
    .eq("date", date)
    .maybeSingle();
  if (existing) {
    if (category) await supabase.from("planned_days").update({ category }).eq("id", existing.id);
    redirect(`/day/${existing.id}`);
  }

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
