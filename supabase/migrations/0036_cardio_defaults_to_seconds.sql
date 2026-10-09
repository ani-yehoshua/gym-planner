-- Timed exercises store their numbers in seconds, but the four cardio machines
-- were seeded with minute-sized defaults (15–30 for the bike), which read as
-- "0:15–0:30". Convert those defaults to seconds.
--
-- Days already planned from the untouched catalog default (the target still
-- equals it exactly) are converted too; anything a member chose themselves
-- (their own defaults, day targets, logged sets) is left as it is.
-- The `< 60` guard keeps this safe to run twice.
with machines as (
  select id, default_rep_min as old_min, default_rep_max as old_max
  from exercises
  where name in ('Incline Treadmill Walk', 'Rowing Machine', 'Stairmaster', 'Stationary Bike')
    and default_rep_max < 60
)
update planned_day_exercises p
  set target_rep_min = p.target_rep_min * 60,
      target_rep_max = p.target_rep_max * 60
  from machines m
  where p.exercise_id = m.id
    and p.target_rep_min = m.old_min
    and p.target_rep_max = m.old_max;

update exercises
  set default_rep_min = default_rep_min * 60,
      default_rep_max = default_rep_max * 60
  where name in ('Incline Treadmill Walk', 'Rowing Machine', 'Stairmaster', 'Stationary Bike')
    and default_rep_max < 60;
