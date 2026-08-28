"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDays, startOfWeek } from "@/lib/date";
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
    await applyTemplateInternal(supabase, user.id, templateId);
  }

  redirect("/");
}

// ---------------------------------------------------------------------------
// templates
// ---------------------------------------------------------------------------
async function applyTemplateInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  templateId: string,
  fromDate?: string,
  weeksOverride?: number,
) {
  const { data: tmpl } = await supabase
    .from("schedule_templates")
    .select("id, default_weeks, template_days(weekday, category, label, template_day_exercises(exercise_id, sort, sets, rep_min, rep_max))")
    .eq("id", templateId)
    .single();
  if (!tmpl) return;

  const weeks = weeksOverride ?? tmpl.default_weeks;
  const start = startOfWeek(fromDate ?? new Date().toISOString().slice(0, 10));

  for (let w = 0; w < weeks; w++) {
    for (const td of tmpl.template_days) {
      // weekday: 0 = Sunday ... convert to Monday-start offset
      const offset = (td.weekday + 6) % 7;
      const date = addDays(start, w * 7 + offset);

      const { data: day } = await supabase
        .from("planned_days")
        .insert({
          owner_user: userId,
          date,
          category: td.category,
          label: td.label,
          created_by: userId,
        })
        .select("id")
        .single();
      if (!day) continue;

      const rows = td.template_day_exercises
        .sort((a, b) => a.sort - b.sort)
        .map((e) => ({
          planned_day_id: day.id,
          exercise_id: e.exercise_id,
          sort: e.sort,
          target_sets: e.sets,
          target_rep_min: e.rep_min,
          target_rep_max: e.rep_max,
          added_by: userId,
        }));
      if (rows.length) await supabase.from("planned_day_exercises").insert(rows);
    }
  }
}

export async function applyTemplate(formData: FormData) {
  const { supabase, user } = await requireUser();
  const templateId = String(formData.get("template_id"));
  const fromDate = String(formData.get("from_date") || "") || undefined;
  const weeks = formData.get("weeks") ? Number(formData.get("weeks")) : undefined;
  await applyTemplateInternal(supabase, user.id, templateId, fromDate, weeks);
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
  await supabase.from("exercises").insert({
    name,
    category,
    primary_muscles: primary,
    howto_text: String(formData.get("howto_text") || "") || null,
    created_by: user.id,
    is_public: false,
  });
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
    .select("default_sets, default_rep_min, default_rep_max")
    .eq("id", exerciseId)
    .single();
  const { count } = await supabase
    .from("planned_day_exercises")
    .select("id", { count: "exact", head: true })
    .eq("planned_day_id", dayId);

  await supabase.from("planned_day_exercises").insert({
    planned_day_id: dayId,
    exercise_id: exerciseId,
    sort: count ?? 0,
    target_sets: ex?.default_sets ?? 3,
    target_rep_min: ex?.default_rep_min ?? 8,
    target_rep_max: ex?.default_rep_max ?? 12,
    added_by: user.id,
  });
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
