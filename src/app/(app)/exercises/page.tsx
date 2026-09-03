import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
    deleteExercise,
    dismissExerciseRequest,
    requestExercise,
    setExerciseArchived,
} from "@/app/actions";
import { CATEGORY_LABEL, CATEGORY_ORDER, muscleList } from "@/lib/labels";
import { ExerciseDetailBody } from "@/components/exercise-detail";
import { ExercisePrefForm } from "@/components/exercise-pref-form";
import { ExerciseForm } from "@/components/exercise-form";
import { SubmitButton } from "@/components/submit-button";
import { recommendedReps, isCompound, type Goal } from "@/lib/targets";
import { isAdmin } from "@/lib/admin";
import type { Enums } from "@/lib/supabase/database.types";

const inp = "rounded-lg border border-border bg-surface px-3 py-2 text-sm";
const archiveBtn =
    "rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-300";
const deleteBtn =
    "rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-300";
const neutralBtn =
    "rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface disabled:opacity-50";

export default async function ExercisesPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const admin = await isAdmin(supabase);

    const { data: allExercises } = await supabase
        .from("exercises")
        .select(
            "id, name, category, primary_muscles, secondary_muscles, howto_text, media_url, default_sets, default_rep_min, default_rep_max, created_by, archived_at",
        )
        .order("category")
        .order("name");

    const exercises = (allExercises ?? []).filter(e => !e.archived_at);
    const archived = admin
        ? (allExercises ?? []).filter(e => e.archived_at)
        : [];

    const { data: prefRows } = await supabase
        .from("user_exercise_prefs")
        .select(
            "exercise_id, default_sets, default_rep_min, default_rep_max, default_weight",
        )
        .eq("user_id", user.id);
    const prefs = new Map((prefRows ?? []).map(p => [p.exercise_id, p]));

    const { data: constants } = await supabase
        .from("user_constants")
        .select("primary_goal")
        .eq("user_id", user.id)
        .maybeSingle();
    const goal = (constants?.primary_goal as Goal) ?? null;

    const { data: requests } = await supabase
        .from("exercise_requests")
        .select("id, name, note, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false });

    type Ex = (typeof exercises)[number];
    const grouped = new Map<Enums<"muscle_category">, Ex[]>();
    for (const e of exercises) {
        const arr = grouped.get(e.category) ?? [];
        arr.push(e);
        grouped.set(e.category, arr);
    }

    return (
        <div className='flex flex-col gap-2'>
            <h1 className='text-lg font-semibold'>Exercises</h1>

            {admin ? (
                <>
                    <details className='rounded-xl border border-border p-3'>
                        <summary className='cursor-pointer text-sm font-medium'>
                            Add an exercise to the catalog
                        </summary>
                        <div className='mt-3'>
                            <ExerciseForm />
                        </div>
                    </details>

                    {(requests ?? []).length > 0 && (
                        <div className='rounded-xl border border-border p-3'>
                            <div className='text-sm font-medium'>
                                Requests ({requests!.length})
                            </div>
                            <ul className='mt-2 flex flex-col gap-2'>
                                {requests!.map(r => (
                                    <li
                                        key={r.id}
                                        className='rounded-lg border border-border'>
                                        <details>
                                            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm'>
                                                <span>
                                                    {r.name}
                                                    {r.note && (
                                                        <span className='ml-2 text-xs text-text-muted'>
                                                            — {r.note}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className='text-xs text-text-muted'>
                                                    ▾
                                                </span>
                                            </summary>
                                            <div className='flex flex-col gap-3 border-t border-border p-3'>
                                                <ExerciseForm
                                                    defaultName={r.name}
                                                    requestId={r.id}
                                                    submitLabel='Add to catalog'
                                                />
                                                <form
                                                    action={
                                                        dismissExerciseRequest
                                                    }>
                                                    <input
                                                        type='hidden'
                                                        name='request_id'
                                                        value={r.id}
                                                    />
                                                    <SubmitButton
                                                        pendingText='…'
                                                        className='text-xs text-text-muted hover:text-rose-400 disabled:opacity-50'>
                                                        Dismiss request
                                                    </SubmitButton>
                                                </form>
                                            </div>
                                        </details>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            ) : (
                <details className='rounded-xl border border-border p-3'>
                    <summary className='cursor-pointer text-sm font-medium'>
                        Request an exercise
                    </summary>
                    <form
                        action={requestExercise}
                        className='mt-3 flex flex-col gap-3'>
                        <input
                            name='name'
                            required
                            placeholder='Exercise name'
                            className={inp}
                        />
                        <textarea
                            name='note'
                            rows={2}
                            placeholder="Anything else — a link, how it's done, why you want it (optional)"
                            className={inp}
                        />
                        <SubmitButton
                            pendingText='Sending…'
                            className='self-start rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50'>
                            Send request
                        </SubmitButton>
                        <p className='text-xs text-text-muted'>
                            Goes to the app admin. You&apos;ll see it in the
                            catalog once it&apos;s added.
                        </p>
                    </form>
                </details>
            )}

            {admin && (
                <a
                    href='/admin/splits'
                    className='rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-surface'>
                    Edit split presets →
                </a>
            )}

            {admin && archived.length > 0 && (
                <details className='rounded-xl border border-border p-3'>
                    <summary className='cursor-pointer text-sm font-medium'>
                        Archived ({archived.length})
                    </summary>
                    <ul className='mt-2 flex flex-col gap-1'>
                        {archived.map(e => (
                            <li
                                key={e.id}
                                className='flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm'>
                                <span className='text-text-muted'>
                                    {e.name}
                                    <span className='ml-2 text-xs'>
                                        {CATEGORY_LABEL[e.category]}
                                    </span>
                                </span>
                                <div className='flex gap-2'>
                                    <form action={setExerciseArchived}>
                                        <input
                                            type='hidden'
                                            name='exercise_id'
                                            value={e.id}
                                        />
                                        <input
                                            type='hidden'
                                            name='archived'
                                            value='false'
                                        />
                                        <SubmitButton
                                            pendingText='…'
                                            className={neutralBtn}>
                                            Unarchive
                                        </SubmitButton>
                                    </form>
                                    <form action={deleteExercise}>
                                        <input
                                            type='hidden'
                                            name='exercise_id'
                                            value={e.id}
                                        />
                                        <SubmitButton
                                            pendingText='…'
                                            className={deleteBtn}>
                                            Delete
                                        </SubmitButton>
                                    </form>
                                </div>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {CATEGORY_ORDER.filter(c => grouped.has(c)).map(c => (
                <details
                    key={c}
                    className='rounded-xl border border-border'>
                    <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-semibold'>
                        {CATEGORY_LABEL[c]}
                        <span className='text-xs font-normal text-text-muted'>
                            {grouped.get(c)!.length} ▾
                        </span>
                    </summary>
                    <ul className='flex flex-col gap-1 border-t border-border p-2'>
                        {grouped.get(c)!.map(e => (
                            <li
                                key={e.id}
                                className='rounded-lg border border-border'>
                                <details className='group'>
                                    <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm'>
                                        <span>{e.name}</span>
                                        <span className='text-xs text-text-muted group-open:hidden'>
                                            {muscleList(e.primary_muscles)}
                                        </span>
                                    </summary>
                                    <div className='border-t border-border px-3 py-3'>
                                        <ExerciseDetailBody ex={e} />
                                        {(() => {
                                            const [rMin, rMax] =
                                                recommendedReps(
                                                    goal,
                                                    isCompound(e),
                                                );
                                            return (
                                                <ExercisePrefForm
                                                    exerciseId={e.id}
                                                    pref={
                                                        prefs.get(e.id) ?? null
                                                    }
                                                    fallback={{
                                                        sets: 2,
                                                        repMin: rMin,
                                                        repMax: rMax,
                                                    }}
                                                />
                                            );
                                        })()}
                                        {admin && (
                                            <div className='mt-3 border-t border-border pt-3'>
                                                <details>
                                                    <summary className='cursor-pointer text-xs font-medium text-text-muted'>
                                                        Edit exercise
                                                    </summary>
                                                    <div className='mt-3'>
                                                        <ExerciseForm
                                                            exercise={e}
                                                        />
                                                    </div>
                                                </details>
                                                <div className='mt-3 flex gap-2'>
                                                    <form
                                                        action={
                                                            setExerciseArchived
                                                        }>
                                                        <input
                                                            type='hidden'
                                                            name='exercise_id'
                                                            value={e.id}
                                                        />
                                                        <input
                                                            type='hidden'
                                                            name='archived'
                                                            value='true'
                                                        />
                                                        <SubmitButton
                                                            pendingText='…'
                                                            className={
                                                                archiveBtn
                                                            }>
                                                            Archive
                                                        </SubmitButton>
                                                    </form>
                                                    <form
                                                        action={deleteExercise}>
                                                        <input
                                                            type='hidden'
                                                            name='exercise_id'
                                                            value={e.id}
                                                        />
                                                        <SubmitButton
                                                            pendingText='…'
                                                            className={
                                                                deleteBtn
                                                            }>
                                                            Delete
                                                        </SubmitButton>
                                                    </form>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            </li>
                        ))}
                    </ul>
                </details>
            ))}
        </div>
    );
}
