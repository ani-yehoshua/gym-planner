-- What an exercise is done with, for the equipment filter (barbell, dumbbell,
-- cable…). Null = not specified. Filled in below from the names; admins can fix
-- any of them on the exercise form.
alter table exercises
  add column equipment text
  check (equipment in ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band'));

-- 1) obvious from the name (checked in this order)
update exercises set equipment = case
  when name ilike '%kettlebell%' then 'kettlebell'
  when name ilike '%dumbbell%' then 'dumbbell'
  when name ilike '%resistance band%' then 'band'
  when name ilike '%barbell%' or name ilike '%ez-bar%' or name ilike '%hex-bar%' then 'barbell'
  when name ilike '%smith%' or name ilike '%machine%' or name ilike 'pec deck%' then 'machine'
  when name ilike '%cable%' or name ilike '%pulldown%' or name ilike '%rope %' or name ilike '%pushdown%' or name = 'Face Pull' then 'cable'
  else null
end;

-- 2) well-known lifts whose names don't say
update exercises set equipment = 'barbell' where name in (
  'Conventional Deadlift', 'Sumo Deadlift', 'Romanian Deadlift', 'Front Squat', 'Hip Thrust',
  'Push Press', 'Log Press', 'Close-Grip Bench Press', 'Landmine Row', 'Landmine Press',
  'Meadows Row (Single Arm)', 'T-Bar Row', 'Skull Crushers (Lying)', 'Preacher Curl', 'Seated Preacher Curl');

update exercises set equipment = 'dumbbell' where name in (
  'Goblet Squat', 'Arnold Press', 'Zottman Curl', 'Farmer''s Carry');

update exercises set equipment = 'machine' where name in (
  'Leg Press', 'Leg Extension', 'Single-Leg Leg Extension', 'Lying Leg Curl', 'Seated Leg Curl',
  'Single-Leg Hamstring Curl (Seated)', 'Hack Squat', 'Seated Calf Raise', 'Standing Calf Raise',
  'Assisted Pull-up', 'Assisted Dips', 'Incline Treadmill Walk', 'Stairmaster', 'Stationary Bike');

update exercises set equipment = 'bodyweight' where name in (
  'Push-Up', 'Incline Push-Up', 'Decline Push-Up', 'Diamond Push-Up', 'Wide-Grip Push-Ups',
  'Pull-up', 'Chin-Ups', 'Neutral-Grip Pull-Up', 'Archer Pulls', 'Dips', 'Bodyweight Squat',
  'Jump Squat', 'Wall Sit', 'Flutter Kicks', 'Hanging Leg Raise', 'Russian Twists',
  'Side Plank Raises', 'Weighted Plank', 'Walking Lunge', 'Oblique Raise', 'Ab Wheel Rollout');
