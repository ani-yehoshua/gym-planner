-- planned_day_exercises write rules split out of the old `pde_write` (FOR ALL):
--  - insert: parent day editable + added_by must be you
--  - update: any editor of the parent day (shared list stays collaborative)
--  - delete: personal-day owner deletes anything; on a party day you delete what
--    you added, and the party owner deletes anything
drop policy if exists pde_write on planned_day_exercises;

create policy pde_insert on planned_day_exercises for insert to authenticated
with check (
  added_by = auth.uid()
  and exists (
    select 1 from planned_days d
    where d.id = planned_day_id
      and (d.owner_user = auth.uid() or is_party_member(d.party_id))
  )
);

create policy pde_update on planned_day_exercises for update to authenticated
using (
  exists (
    select 1 from planned_days d
    where d.id = planned_day_id
      and (d.owner_user = auth.uid() or is_party_member(d.party_id))
  )
)
with check (
  exists (
    select 1 from planned_days d
    where d.id = planned_day_id
      and (d.owner_user = auth.uid() or is_party_member(d.party_id))
  )
);

create policy pde_delete on planned_day_exercises for delete to authenticated
using (
  exists (
    select 1 from planned_days d
    where d.id = planned_day_id
      and (
        d.owner_user = auth.uid()
        or (
          d.party_id is not null
          and (planned_day_exercises.added_by = auth.uid() or is_party_owner(d.party_id))
        )
      )
  )
);
