-- Programs become multi-day: an admin builds an ordered list of days (training
-- days with exercises, or rest days), plus a duration in days or weeks. Loading
-- a program from a start date repeats that list on consecutive dates until the
-- duration is filled. No session type any more — each day just has a name.

create table program_days (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  position   int not null default 0,
  name       text not null default 'Day',
  is_rest    boolean not null default false
);

alter table program_days enable row level security;
grant select, insert, update, delete on program_days to anon, authenticated;
create policy prd_select on program_days for select to authenticated using (true);
create policy prd_write on program_days for all to authenticated
  using (is_admin()) with check (is_admin());

-- every existing single-day program becomes a one-day program, keeping its exercises
insert into program_days (program_id, position, name)
  select id, 0, name from programs;

alter table program_exercises
  add column program_day_id uuid references program_days(id) on delete cascade;
update program_exercises pe
  set program_day_id = d.id
  from program_days d
  where d.program_id = pe.program_id;
alter table program_exercises alter column program_day_id set not null;
-- also drops the old unique (program_id, exercise_id)
alter table program_exercises drop column program_id;
alter table program_exercises
  add constraint program_exercises_day_exercise_key unique (program_day_id, exercise_id);

alter table programs drop column category;
alter table programs
  add column duration_unit  text not null default 'weeks'
    check (duration_unit in ('days', 'weeks')),
  add column duration_count int  not null default 1
    check (duration_count between 1 and 365);

-- the program a user is currently running: loaded from start_date, finished
-- after end_date (which is when they're offered a repeat or a new program)
create table user_programs (
  user_id    uuid primary key references profiles(id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now()
);

alter table user_programs enable row level security;
grant select, insert, update, delete on user_programs to anon, authenticated;
create policy up_own on user_programs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The program's own target reps for an exercise on a day planned from it.
-- Shown read-only beside the set rows, separate from the member's editable
-- targets.
alter table planned_day_exercises
  add column prog_rep_min int,
  add column prog_rep_max int;
