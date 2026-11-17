-- When a member changes the sets or rep range of an exercise on a shared party
-- day, every other member gets a proposal to accept or decline. Accepting
-- applies the change to that member's own targets for the exercise; declining
-- leaves their session alone. One proposal per exercise, recipient and proposer: a
-- newer change from the same member folds into it, keeping the original "from"
-- values.
create table party_change_proposals (
  id                      uuid primary key default gen_random_uuid(),
  planned_day_id          uuid not null references planned_days(id) on delete cascade,
  planned_day_exercise_id uuid not null references planned_day_exercises(id) on delete cascade,
  proposer                uuid not null references profiles(id) on delete cascade,
  recipient               uuid not null references profiles(id) on delete cascade,
  old_sets                int,
  new_sets                int,
  old_rep_min             int,
  old_rep_max             int,
  new_rep_min             int,
  new_rep_max             int,
  status                  text not null default 'pending'
                            check (status in ('pending', 'accepted', 'declined')),
  created_at              timestamptz not null default now(),
  resolved_at             timestamptz,
  unique (planned_day_exercise_id, recipient, proposer)
);
create index party_change_proposals_recipient_idx
  on party_change_proposals (recipient, status);

alter table party_change_proposals enable row level security;
grant select, insert, update, delete on party_change_proposals to authenticated;

create policy pcp_read on party_change_proposals for select to authenticated
  using (recipient = auth.uid() or proposer = auth.uid());

-- a member can propose to other members of the party the day belongs to
create policy pcp_propose on party_change_proposals for insert to authenticated
  with check (
    proposer = auth.uid()
    and recipient <> auth.uid()
    and exists (
      select 1 from planned_days d
      join party_members pm on pm.party_id = d.party_id and pm.user_id = recipient
      where d.id = planned_day_id and is_party_member(d.party_id)
    )
  );
-- a new change reopens an exercise whose last proposal was already answered
create policy pcp_revise on party_change_proposals for update to authenticated
  using (proposer = auth.uid())
  with check (proposer = auth.uid() and status = 'pending');
create policy pcp_withdraw on party_change_proposals for delete to authenticated
  using (proposer = auth.uid() and status = 'pending');
-- the recipient decides
create policy pcp_respond on party_change_proposals for update to authenticated
  using (recipient = auth.uid()) with check (recipient = auth.uid());

alter publication supabase_realtime add table party_change_proposals;
