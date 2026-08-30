import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createParty, joinParty } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("party_members")
    .select("role, parties(id, name, invite_type)")
    .eq("user_id", user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Parties</h1>

      <ul className="flex flex-col gap-2">
        {(memberships ?? []).map((m) =>
          m.parties ? (
            <li key={m.parties.id}>
              <Link
                href={`/parties/${m.parties.id}`}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-surface"
              >
                <span className="font-medium">{m.parties.name}</span>
                <span className="text-xs text-text-muted">
                  {m.role === "owner" ? "Owner" : "Member"} ·{" "}
                  {m.parties.invite_type === "open" ? "Open" : "Invite only"}
                </span>
              </Link>
            </li>
          ) : null,
        )}
        {(memberships ?? []).length === 0 && (
          <p className="text-sm text-text-muted">
            You&apos;re not in any parties yet. Create one to plan and train with others.
          </p>
        )}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <form
          action={createParty}
          className="flex flex-col gap-2 rounded-xl border border-border p-4"
        >
          <span className="text-sm font-medium">Create a party</span>
          <input
            name="name"
            required
            placeholder="Party name"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <select
            name="invite_type"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="invite_only">Invite only</option>
            <option value="open">Open (anyone with the code)</option>
          </select>
          <SubmitButton
            pendingText="Creating…"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
          >
            Create
          </SubmitButton>
        </form>

        <form
          action={joinParty}
          className="flex flex-col gap-2 rounded-xl border border-border p-4"
        >
          <span className="text-sm font-medium">Join with a code</span>
          <input
            name="code"
            required
            placeholder="ABC123"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm uppercase"
          />
          <SubmitButton
            pendingText="Joining…"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50"
          >
            Join
          </SubmitButton>
          {error === "join" && (
            <p className="text-xs text-rose-400">
              That code didn&apos;t work — check it and try again.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
