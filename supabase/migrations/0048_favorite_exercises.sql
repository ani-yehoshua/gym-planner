-- Exercises a member hearts. Private to them; shown as their own Favorites
-- list on the Exercises tab and as a filled heart on exercise cards.
create table user_favorite_exercises (
  user_id     uuid not null references profiles(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
alter table user_favorite_exercises enable row level security;
grant select, insert, delete on user_favorite_exercises to authenticated;
create policy ufe_own on user_favorite_exercises for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
