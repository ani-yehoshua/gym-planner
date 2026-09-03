-- Parties are code-based only now. Drop the "open" self-join path and the
-- open-party read exception; keep the invite_type column for now (unused).
drop policy if exists pm_insert on party_members;

drop policy if exists party_select on parties;
create policy party_select on parties for select to authenticated
  using (is_party_member(id) or created_by = auth.uid());
