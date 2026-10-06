-- A program exercise can give each set its own rep range (e.g. 12–15, then
-- 10–12, then 8–10). Stored as an array with one {min, max} per set; if there
-- are fewer entries than sets, the last one repeats. rep_min / rep_max stay as
-- the overall range (lowest min, highest max) so everything that only needs a
-- single range keeps working.
alter table program_exercises add column set_reps jsonb;

-- existing single ranges become a one-entry list, which applies to every set
update program_exercises
  set set_reps = jsonb_build_array(jsonb_build_object('min', rep_min, 'max', rep_max))
  where rep_min is not null or rep_max is not null;

-- the same per-set targets, copied onto a day planned from the program, so the
-- day page can state them for each set
alter table planned_day_exercises add column program_set_reps jsonb;
