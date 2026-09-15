-- "Weighted" flag: whether a weight field applies to this exercise by
-- default. Most exercises do; pure bodyweight moves (push-ups, hanging leg
-- raise, etc.) default to false but a user can still turn it back on for
-- themselves via their own target/pref (the UI just stops hiding the field).
alter table exercises add column weighted boolean not null default true;

-- Measurement type, more granular than the existing time_based flag:
--   reps              - sets of weight x reps (default, unchanged behavior)
--   time              - sets of a duration in seconds (time_based = true)
--   distance          - sets of a distance (miles/km, per the user's units)
--   time_or_distance  - either, chosen per day (log_mode) or defaulted per
--                       user (default_log_mode) -- e.g. farmer's carry, a
--                       treadmill walk you might track by time or by distance
create type exercise_measurement as enum ('reps', 'time', 'distance', 'time_or_distance');
alter table exercises add column measurement exercise_measurement not null default 'reps';
update exercises set measurement = 'time' where time_based = true;

-- catalog-level default distance target (parallels default_rep_min/max)
alter table exercises add column default_distance numeric;

-- actual logged distance per set, alongside the existing weight/reps
alter table set_logs add column distance numeric;

-- planned/target distance, mirrored everywhere target_weight already lives
alter table planned_day_exercises add column target_distance numeric;
alter table day_exercise_user_targets add column target_distance numeric;
alter table user_exercise_prefs add column default_distance numeric;

-- per-session and per-user default mode for time_or_distance exercises
alter table planned_day_exercises add column log_mode text check (log_mode in ('time', 'distance'));
alter table user_exercise_prefs add column default_log_mode text check (default_log_mode in ('time', 'distance'));

-- reclassify known bodyweight-only movements already in the catalog
update exercises set weighted = false where name in (
  'Push-Up', 'Decline Push-Up', 'Incline Push-Up', 'Diamond Push-Up', 'Wide-Grip Push-Ups',
  'Pull-up', 'Chin-Ups', 'Neutral-Grip Pull-Up',
  'Hanging Leg Raise', 'Bodyweight Squat', 'Jump Squat', 'Side Plank Raises'
);

-- Farmer's Carry (weighted, timed or by distance) and a treadmill walk
-- (unweighted, timed or by distance) support both modes
update exercises set measurement = 'time_or_distance', time_based = true
  where name in ('Farmer''s Carry', 'Incline Treadmill Walk');
update exercises set weighted = false where name = 'Incline Treadmill Walk';
