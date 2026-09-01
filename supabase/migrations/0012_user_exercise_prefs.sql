-- Per-user default sets / rep range for an exercise, used when it's added to a day.
create table user_exercise_prefs (
  user_id       uuid not null references profiles(id) on delete cascade,
  exercise_id   uuid not null references exercises(id) on delete cascade,
  default_sets    integer,
  default_rep_min integer,
  default_rep_max integer,
  updated_at    timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
alter table user_exercise_prefs enable row level security;
grant select, insert, update, delete on user_exercise_prefs to anon, authenticated;
create trigger user_exercise_prefs_touch
  before update on user_exercise_prefs
  for each row execute function touch_updated_at();
create policy uep_own on user_exercise_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
