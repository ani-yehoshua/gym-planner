import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveOnboarding } from "@/app/actions";
import { MUSCLE_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

const GOALS = [
  ["build_muscle", "Build muscle"],
  ["get_stronger", "Get stronger"],
  ["lose_fat", "Lose fat"],
  ["general_fitness", "General fitness"],
] as const;

const EXPERIENCE: [Enums<"experience_level">, string][] = [
  ["beginner", "New to the gym"],
  ["returning", "Coming back after a layoff"],
  ["intermediate", "A year or two of steady training"],
  ["advanced", "Many years, know my numbers"],
];

const FOCUS: Enums<"muscle_group">[] = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "abs",
];

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .single();
  if (profile?.onboarded_at) redirect("/");

  const { data: templates } = await supabase
    .from("schedule_templates")
    .select("id, name, description")
    .eq("is_global", true)
    .order("name");

  const field = "flex flex-col gap-1.5";
  const label = "text-sm font-medium";
  const input =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500";

  return (
    <div className="mx-auto w-full max-w-lg p-6">
      <h1 className="text-xl font-semibold">Let&apos;s set you up</h1>
      <p className="mt-1 text-sm text-zinc-400">
        A few basics. You can change all of this later.
      </p>

      <form action={saveOnboarding} className="mt-6 flex flex-col gap-5">
        <div className={field}>
          <label className={label} htmlFor="display_name">
            Display name
          </label>
          <input id="display_name" name="display_name" className={input} />
        </div>

        <div className={field}>
          <span className={label}>Units</span>
          <div className="flex gap-2">
            {(["lb", "kg"] as const).map((u, i) => (
              <label
                key={u}
                className="flex-1 cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-center text-sm has-[:checked]:border-white has-[:checked]:bg-zinc-800"
              >
                <input
                  type="radio"
                  name="units"
                  value={u}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                {u}
              </label>
            ))}
          </div>
        </div>

        <div className={field}>
          <span className={label}>Experience</span>
          <div className="flex flex-col gap-2">
            {EXPERIENCE.map(([v, l]) => (
              <label
                key={v}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm has-[:checked]:border-white has-[:checked]:bg-zinc-800"
              >
                <input type="radio" name="experience" value={v} className="accent-white" />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className={field}>
          <span className={label}>Primary goal</span>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map(([v, l]) => (
              <label
                key={v}
                className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-center text-sm has-[:checked]:border-white has-[:checked]:bg-zinc-800"
              >
                <input type="radio" name="primary_goal" value={v} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className={field}>
          <span className={label}>Focus muscles (optional)</span>
          <div className="flex flex-wrap gap-2">
            {FOCUS.map((m) => (
              <label
                key={m}
                className="cursor-pointer rounded-full border border-zinc-700 px-3 py-1 text-xs has-[:checked]:border-white has-[:checked]:bg-zinc-800"
              >
                <input type="checkbox" name="focus_muscles" value={m} className="sr-only" />
                {MUSCLE_LABEL[m]}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className={field}>
            <label className={label} htmlFor="current_bodyweight">
              Bodyweight
            </label>
            <input
              id="current_bodyweight"
              name="current_bodyweight"
              type="number"
              step="0.1"
              className={input}
            />
          </div>
          <div className={field}>
            <label className={label} htmlFor="target_bodyweight">
              Target
            </label>
            <input
              id="target_bodyweight"
              name="target_bodyweight"
              type="number"
              step="0.1"
              className={input}
            />
          </div>
          <div className={field}>
            <label className={label} htmlFor="weekly_gain_target">
              +/wk
            </label>
            <input
              id="weekly_gain_target"
              name="weekly_gain_target"
              type="number"
              step="0.05"
              placeholder="0.3"
              className={input}
            />
          </div>
        </div>

        <div className={field}>
          <span className={label}>Start with a schedule</span>
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm has-[:checked]:border-white has-[:checked]:bg-zinc-800">
              <input type="radio" name="template_id" value="none" defaultChecked className="accent-white" />
              <span>
                <span className="font-medium">Empty calendar</span>
                <span className="block text-xs text-zinc-400">Plan day by day yourself.</span>
              </span>
            </label>
            {(templates ?? [])
              .filter((t) => t.name !== "Blank")
              .map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm has-[:checked]:border-white has-[:checked]:bg-zinc-800"
                >
                  <input type="radio" name="template_id" value={t.id} className="accent-white" />
                  <span>
                    <span className="font-medium">{t.name}</span>
                    <span className="block text-xs text-zinc-400">{t.description}</span>
                  </span>
                </label>
              ))}
          </div>
        </div>

        <button className="rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-black">
          Start planning
        </button>
      </form>
    </div>
  );
}
