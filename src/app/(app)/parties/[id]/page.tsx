import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPartyDay, renameParty } from "@/app/actions";
import { PartyInvite } from "@/components/party-invite";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SubmitButton } from "@/components/submit-button";
import { DeletePartyButton, LeavePartyButton } from "@/components/danger-button";
import { ChevronLeftIcon } from "@/components/icons";
import {
    CATEGORY_LABEL,
    CATEGORY_STYLE,
    DAY_CATEGORY_CHOICES,
} from "@/lib/labels";
import { formatLong } from "@/lib/date";
import { getUserToday } from "@/lib/user-today";

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

export default async function PartyPage({
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

    const todayISO = await getUserToday();

    const { data: party } = await supabase
        .from("parties")
        .select("id, name, created_by")
        .eq("id", id)
        .maybeSingle();
    if (!party) notFound();

    const { data: members } = await supabase
        .from("party_members")
        .select("user_id, role, joined_at, profiles(display_name)")
        .eq("party_id", id)
        .order("joined_at");

    const { data: invites } = await supabase
        .from("party_invites")
        .select("code")
        .eq("party_id", id)
        .limit(1);

    const { data: days } = await supabase
        .from("planned_days")
        .select("id, date, category, planned_day_exercises(id)")
        .eq("party_id", id)
        .gte("date", todayISO)
        .order("date")
        .limit(10);

    const isOwner = members?.some(
        m => m.user_id === user.id && m.role === "owner",
    );

    return (
        <div className='flex flex-col gap-6'>
            <RealtimeRefresh
                channel={`party:${id}`}
                tables={[
                    { table: "party_members", filter: `party_id=eq.${id}` },
                    { table: "planned_days", filter: `party_id=eq.${id}` },
                ]}
            />
            <div className='flex items-center justify-between'>
                <Link
                    href='/parties'
                    className='flex items-center gap-1 text-sm text-text-muted hover:text-text'>
                    <ChevronLeftIcon />
                    Parties
                </Link>
                {isOwner ? (
                    <DeletePartyButton partyId={id} />
                ) : (
                    <LeavePartyButton partyId={id} />
                )}
            </div>

            <div>
                {isOwner ? (
                    <form
                        action={renameParty}
                        className='flex flex-col gap-1'>
                        <label className='text-xs text-text-muted'>
                            Party name
                        </label>
                        <div className='flex items-center gap-2'>
                            <input
                                type='hidden'
                                name='party_id'
                                value={id}
                            />
                            <input
                                name='name'
                                defaultValue={party.name}
                                className='min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-text-muted'
                            />
                            <SubmitButton
                                pendingText='Saving…'
                                className='shrink-0 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50'>
                                Save
                            </SubmitButton>
                        </div>
                    </form>
                ) : (
                    <h1 className='text-lg font-semibold'>{party.name}</h1>
                )}
            </div>

            {invites?.[0] && (
                <PartyInvite
                    code={invites[0].code}
                    partyName={party.name}
                />
            )}

            <div>
                <h2 className='mb-2 text-sm font-semibold text-text-muted'>
                    Members ({members?.length ?? 0})
                </h2>
                <ul className='flex flex-col gap-1'>
                    {(members ?? []).map((m, i) => (
                        <li
                            key={m.user_id}
                            className='flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm'>
                            <span className='flex items-center gap-2'>
                                <span
                                    className='inline-block h-2.5 w-2.5 rounded-full'
                                    style={{
                                        background:
                                            MEMBER_COLORS[
                                                i % MEMBER_COLORS.length
                                            ],
                                    }}
                                />
                                {m.profiles?.display_name || "Member"}
                                {m.user_id === user.id && (
                                    <span className='text-text-muted'>
                                        {" "}
                                        (you)
                                    </span>
                                )}
                            </span>
                            {m.role === "owner" && (
                                <span className='text-xs text-text-muted'>
                                    Owner
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            <form
                action={createPartyDay}
                className='rounded-xl border border-border p-4'>
                <span className='text-sm font-medium'>Plan a shared day</span>
                <input
                    type='hidden'
                    name='party_id'
                    value={id}
                />
                <div className='mt-2 flex flex-wrap gap-2'>
                    <input
                        type='date'
                        name='date'
                        required
                        defaultValue={todayISO}
                        className='rounded-lg border border-border bg-surface px-3 py-2 text-sm'
                    />
                    <select
                        name='category'
                        className='rounded-lg border border-border bg-surface px-3 py-2 text-sm'>
                        <option value=''>Category…</option>
                        {DAY_CATEGORY_CHOICES.filter(c => c !== "rest").map(
                            c => (
                                <option
                                    key={c}
                                    value={c}>
                                    {CATEGORY_LABEL[c]}
                                </option>
                            ),
                        )}
                    </select>
                    <SubmitButton
                        pendingText='Opening…'
                        className='rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50'>
                        Open day
                    </SubmitButton>
                </div>
            </form>

            {(days ?? []).length > 0 && (
                <div>
                    <h2 className='mb-2 text-sm font-semibold text-text-muted'>
                        Upcoming shared days
                    </h2>
                    <ul className='flex flex-col gap-1'>
                        {days!.map(d => (
                            <li key={d.id}>
                                <Link
                                    href={`/day/${d.id}`}
                                    className='flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface'>
                                    <span className='flex items-center gap-2'>
                                        {formatLong(d.date)}
                                        {d.category && (
                                            <span
                                                className={`rounded-md border px-2 py-0.5 text-xs ${CATEGORY_STYLE[d.category]}`}>
                                                {CATEGORY_LABEL[d.category]}
                                            </span>
                                        )}
                                    </span>
                                    <span className='text-xs text-text-muted'>
                                        {d.planned_day_exercises.length}{" "}
                                        exercises
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

        </div>
    );
}
