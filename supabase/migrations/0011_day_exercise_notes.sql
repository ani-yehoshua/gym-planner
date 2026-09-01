-- Per-user, per-exercise note for a planned day ("first set felt good at 8...").
create table day_exercise_notes (
  planned_day_exercise_id uuid not null references planned_day_exercises(id) on delete cascade,
  user_id                 uuid not null references profiles(id) on delete cascade,
  note                    text not null default '',
  updated_at              timestamptz not null default now(),
  primary key (planned_day_exercise_id, user_id)
);
alter table day_exercise_notes enable row level security;
grant select, insert, update, delete on day_exercise_notes to anon, authenticated;
create trigger day_exercise_notes_touch
  before update on day_exercise_notes
  for each row execute function touch_updated_at();
create policy den_own on day_exercise_notes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy den_party_read on day_exercise_notes for select to authenticated
  using (
    exists (
      select 1 from planned_day_exercises pde
      join planned_days d on d.id = pde.planned_day_id
      where pde.id = planned_day_exercise_id and is_party_member(d.party_id)
    )
  );
alter publication supabase_realtime add table day_exercise_notes;
