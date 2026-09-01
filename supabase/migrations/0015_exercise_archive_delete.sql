-- Admins can archive (soft, reversible, keeps old day references working) or
-- hard-delete catalog exercises.
alter table exercises add column archived_at timestamptz;

drop policy if exists ex_delete on exercises;
create policy ex_delete on exercises for delete to authenticated
using (created_by = auth.uid() or is_admin());

drop policy if exists ex_update on exercises;
create policy ex_update on exercises for update to authenticated
using (created_by = auth.uid() or is_admin())
with check (created_by = auth.uid() or is_admin());
