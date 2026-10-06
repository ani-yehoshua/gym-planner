-- A day planned from a program remembers which program and which day of it
-- (counting rest days, so it reads "Day 3 - <program> Program" on the calendar),
-- and its exercises are flagged so the sets/reps controls can be locked while
-- the member follows along.
alter table planned_days
  add column program_id         uuid references programs(id) on delete set null,
  add column program_day_number int;

-- replaces the read-only "target reps" column idea: the program's numbers are
-- the exercise's own targets, just locked
alter table planned_day_exercises
  drop column prog_rep_min,
  drop column prog_rep_max,
  add column from_program boolean not null default false;
