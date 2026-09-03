-- Per-user sets / rep range / weight for a planned exercise. On a party day the
-- shared planned_day_exercises row is just the seed; each member's own numbers
-- live here and never affect anyone else. Effective value for (pde, user):
--   day_exercise_user_targets  ->  user_exercise_prefs  ->  exercises.default_*
--   ->  goal-based recommendation
create table day_exercise_user_targets (
  planned_day_exercise_id uuid not null references planned_day_exercises(id) on delete cascade,
  user_id                 uuid not null references profiles(id) on delete cascade,
  target_sets    integer,
  target_rep_min integer,
  target_rep_max integer,
  target_weight  numeric,
  updated_at     timestamptz not null default now(),
  primary key (planned_day_exercise_id, user_id)
);
alter table day_exercise_user_targets enable row level security;
grant select, insert, update, delete on day_exercise_user_targets to anon, authenticated;
create trigger deut_touch
  before update on day_exercise_user_targets
  for each row execute function touch_updated_at();
create policy deut_own on day_exercise_user_targets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
