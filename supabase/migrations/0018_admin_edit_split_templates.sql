-- Let admins edit the global split presets (schedule_templates / template_days /
-- template_day_exercises), and guarantee one template_days row per position.
create unique index if not exists template_days_template_position_uidx
  on template_days (template_id, position);

drop policy if exists st_write on schedule_templates;
create policy st_write on schedule_templates for all to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

drop policy if exists td_write on template_days;
create policy td_write on template_days for all to authenticated
  using (
    is_admin() or exists (
      select 1 from schedule_templates t
      where t.id = template_id and t.created_by = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from schedule_templates t
      where t.id = template_id and t.created_by = auth.uid()
    )
  );

drop policy if exists tde_write on template_day_exercises;
create policy tde_write on template_day_exercises for all to authenticated
  using (
    is_admin() or exists (
      select 1 from template_days d
      join schedule_templates t on t.id = d.template_id
      where d.id = template_day_id and t.created_by = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from template_days d
      join schedule_templates t on t.id = d.template_id
      where d.id = template_day_id and t.created_by = auth.uid()
    )
  );
