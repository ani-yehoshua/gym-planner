import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clearUpcomingCalendar, updateAccount } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { SplitPicker, type SplitTemplate } from "@/components/split-picker";
import { SubmitButton } from "@/components/submit-button";
import { GOAL_LABEL, MUSCLE_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

const EXPERIENCE: [Enums<"experience_level">, string][] = [
    ["beginner", "New to the gym"],
    ["returning", "Coming back after a layoff"],
    ["intermediate", "A year or two of steady training"],
    ["advanced", "Many years, know my numbers"],
];

const FOCUS: Enums<"muscle_group">[] = [
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "quads",
    "hamstrings",
    "glutes",
    "calves",
    "abs",
];

const field = "flex flex-col gap-1.5";
const label = "text-sm font-medium";
const input =
    "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted";

export default async function AccountPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, units")
        .eq("id", user.id)
        .single();

    const { data: c } = await supabase
        .from("user_constants")
        .select(
            "experience, primary_goal, focus_muscles, current_bodyweight, target_bodyweight, weekly_gain_target",
        )
        .eq("user_id", user.id)
        .single();

    const { data: rawTemplates } = await supabase
        .from("schedule_templates")
        .select("id, name, description, template_days(position, category)")
        .eq("is_global", true)
        .neq("name", "Blank")
        .order("name");

    const templates: SplitTemplate[] = (rawTemplates ?? []).map(t => {
        const slots: SplitTemplate["slots"] = Array(7).fill("rest");
        for (const d of t.template_days) {
            if (d.position >= 0 && d.position < 7)
                slots[d.position] = d.category;
        }
        return { id: t.id, name: t.name, description: t.description, slots };
    });

    const focus = c?.focus_muscles ?? [];

    return (
        <div className='flex flex-col gap-8'>
            <h1 className='text-lg font-semibold'>Account</h1>

            <section className={field}>
                <span className={label}>Theme</span>
                <ThemeToggle />
            </section>

            {/* profile + goals */}
            <form
                action={updateAccount}
                className='flex flex-col gap-5'>
                <div className={field}>
                    <label
                        className={label}
                        htmlFor='display_name'>
                        Display name
                    </label>
                    <input
                        id='display_name'
                        name='display_name'
                        defaultValue={profile?.display_name ?? ""}
                        className={input}
                    />
                </div>

                <div className={field}>
                    <span className={label}>Units</span>
                    <div className='flex gap-2'>
                        {(["lb", "kg"] as const).map(u => (
                            <label
                                key={u}
                                className='flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-[:checked]:border-text has-[:checked]:bg-surface-2'>
                                <input
                                    type='radio'
                                    name='units'
                                    value={u}
                                    defaultChecked={
                                        (profile?.units ?? "lb") === u
                                    }
                                    className='sr-only'
                                />
                                {u}
                            </label>
                        ))}
                    </div>
                </div>

                <div className={field}>
                    <span className={label}>Experience</span>
                    <div className='flex flex-col gap-2'>
                        {EXPERIENCE.map(([v, l]) => (
                            <label
                                key={v}
                                className='flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-text has-[:checked]:bg-surface-2'>
                                <input
                                    type='radio'
                                    name='experience'
                                    value={v}
                                    defaultChecked={c?.experience === v}
                                    className='accent-[currentColor]'
                                />
                                {l}
                            </label>
                        ))}
                    </div>
                </div>

                <div className={field}>
                    <span className={label}>Primary goal</span>
                    <div className='grid grid-cols-2 gap-2'>
                        {Object.entries(GOAL_LABEL).map(([v, l]) => (
                            <label
                                key={v}
                                className='cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-[:checked]:border-text has-[:checked]:bg-surface-2'>
                                <input
                                    type='radio'
                                    name='primary_goal'
                                    value={v}
                                    defaultChecked={c?.primary_goal === v}
                                    className='sr-only'
                                />
                                {l}
                            </label>
                        ))}
                    </div>
                </div>

                <div className={field}>
                    <span className={label}>Focus muscles</span>
                    <div className='flex flex-wrap gap-2'>
                        {FOCUS.map(m => (
                            <label
                                key={m}
                                className='cursor-pointer rounded-full border border-border px-3 py-1 text-xs has-[:checked]:border-text has-[:checked]:bg-surface-2'>
                                <input
                                    type='checkbox'
                                    name='focus_muscles'
                                    value={m}
                                    defaultChecked={focus.includes(m)}
                                    className='sr-only'
                                />
                                {MUSCLE_LABEL[m]}
                            </label>
                        ))}
                    </div>
                </div>

                <div className='grid grid-cols-3 gap-3'>
                    <div className={field}>
                        <label
                            className={label}
                            htmlFor='current_bodyweight'>
                            Bodyweight
                        </label>
                        <input
                            id='current_bodyweight'
                            name='current_bodyweight'
                            type='number'
                            step='0.1'
                            defaultValue={c?.current_bodyweight ?? ""}
                            className={input}
                        />
                    </div>
                    <div className={field}>
                        <label
                            className={label}
                            htmlFor='target_bodyweight'>
                            Target
                        </label>
                        <input
                            id='target_bodyweight'
                            name='target_bodyweight'
                            type='number'
                            step='0.1'
                            defaultValue={c?.target_bodyweight ?? ""}
                            className={input}
                        />
                    </div>
                    <div className={field}>
                        <label
                            className={label}
                            htmlFor='weekly_gain_target'>
                            +/wk
                        </label>
                        <input
                            id='weekly_gain_target'
                            name='weekly_gain_target'
                            type='number'
                            step='0.05'
                            defaultValue={c?.weekly_gain_target ?? ""}
                            className={input}
                        />
                    </div>
                </div>

                <button className='self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg'>
                    Save changes
                </button>
            </form>

            {/* schedule / split */}
            <section className='flex flex-col gap-3 border-t border-border pt-6'>
                <span className={label}>Schedule</span>
                <p className='text-xs text-text-muted'>
                    Pick a split, reorder or swap any day, then apply it to your
                    calendar with suggested exercises. Clear upcoming days first
                    for a clean slate.
                </p>
                <form action={clearUpcomingCalendar}>
                    <SubmitButton
                        pendingText='Clearing…'
                        className='rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface disabled:opacity-50'>
                        Clear upcoming planned days
                    </SubmitButton>
                </form>
                <SplitPicker templates={templates} />
            </section>

            <form
                action='/auth/signout'
                method='post'
                className='border-t border-border pt-6'>
                <button className='text-sm text-text-muted hover:text-rose-400'>
                    Sign out
                </button>
            </form>
        </div>
    );
}
