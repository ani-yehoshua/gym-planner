-- The "Last" row on an exercise card, stamped. It's worked out from your
-- history when you first log a set on the exercise that day, then kept with
-- that day: looking back at it later shows what the last time was *then*, not
-- whatever you've done since. `entry` is null when there was no earlier
-- session; the row's existence is what marks it as stamped.
create table day_exercise_last (
  planned_day_exercise_id uuid not null references planned_day_exercises(id) on delete cascade,
  user_id                 uuid not null references profiles(id) on delete cascade,
  entry                   jsonb,
  stamped_at              timestamptz not null default now(),
  primary key (planned_day_exercise_id, user_id)
);
alter table day_exercise_last enable row level security;
grant select, insert, update, delete on day_exercise_last to authenticated;
create policy del_own on day_exercise_last for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
