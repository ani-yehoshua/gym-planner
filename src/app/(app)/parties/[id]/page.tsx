import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPartyDay, leaveParty } from "@/app/actions";
import { CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_STYLE } from "@/lib/labels";
import { formatLong, today } from "@/lib/date";

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

  const { data: party } = await supabase
    .from("parties")
    .select("id, name, invite_type, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!party) notFound();

  const { data: members } = await supabase
    .from("party_members")
    .select("user_id, role, profiles(display_name)")
    .eq("party_id", id);

  const { data: invites } = await supabase
    .from("party_invites")
    .select("code")
    .eq("party_id", id)
    .limit(1);

  const { data: days } = await supabase
    .from("planned_days")
    .select("id, date, category, planned_day_exercises(id)")
    .eq("party_id", id)
    .gte("date", today())
    .order("date")
    .limit(10);

  const isOwner = members?.some((m) => m.user_id === user.id && m.role === "owner");

  const leave = leaveParty.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/parties" className="text-sm text-text-muted hover:text-text">
        ← Parties
      </Link>

      <div>
        <h1 className="text-lg font-semibold">{party.name}</h1>
        <p className="text-sm text-text-muted">
          {party.invite_type === "open" ? "Open party" : "Invite only"}
        </p>
      </div>

      {invites?.[0] && (
        <div className="rounded-xl border border-border p-4">
          <div className="text-xs uppercase text-text-muted">Invite code</div>
          <div className="mt-1 font-mono text-2xl tracking-widest">{invites[0].code}</div>
          <p className="mt-1 text-xs text-text-muted">
            Share this code — others join from the Parties tab.
          </p>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text-muted">
          Members ({members?.length ?? 0})
        </h2>
        <ul className="flex flex-col gap-1">
          {(members ?? []).map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span>
                {m.profiles?.display_name || "Member"}
                {m.user_id === user.id && <span className="text-text-muted"> (you)</span>}
              </span>
              {m.role === "owner" && <span className="text-xs text-text-muted">Owner</span>}
            </li>
          ))}
        </ul>
      </div>

      <form action={createPartyDay} className="rounded-xl border border-border p-4">
        <span className="text-sm font-medium">Plan a shared day</span>
        <input type="hidden" name="party_id" value={id} />
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="date"
            name="date"
            required
            defaultValue={today()}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <select
            name="category"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">Category…</option>
            {CATEGORY_ORDER.filter((c) => c !== "rest").map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg">
            Open day
          </button>
        </div>
      </form>

      {(days ?? []).length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-text-muted">Upcoming shared days</h2>
          <ul className="flex flex-col gap-1">
            {days!.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/day/${d.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface"
                >
                  <span className="flex items-center gap-2">
                    {formatLong(d.date)}
                    {d.category && (
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs ${CATEGORY_STYLE[d.category]}`}
                      >
                        {CATEGORY_LABEL[d.category]}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-text-muted">
                    {d.planned_day_exercises.length} exercises
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isOwner && (
        <form action={leave}>
          <button className="text-xs text-text-muted hover:text-rose-400">Leave party</button>
        </form>
      )}
    </div>
  );
}
