-- The exercises a program is built from: catalog exercises an admin adds to it,
-- shown to members grouped by muscle group (the exercise's category) next to
-- that group's weekly set target. Sets and the rep range are optional notes per
-- exercise; null means "not specified".
create table program_exercises (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references programs(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  sort        int not null default 0,
  sets        int check (sets is null or sets > 0),
  rep_min     int check (rep_min is null or rep_min > 0),
  rep_max     int check (rep_max is null or rep_max > 0),
  unique (program_id, exercise_id)
);

alter table program_exercises enable row level security;

grant select, insert, update, delete on program_exercises to anon, authenticated;

create policy pe_select on program_exercises for select to authenticated using (true);
create policy pe_write on program_exercises for all to authenticated
  using (is_admin()) with check (is_admin());
