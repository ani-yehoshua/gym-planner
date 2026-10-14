-- Grip as a second level under a variation group. A lift like the curl comes in
-- several pieces of equipment (variant_label: Barbell, EZ-bar, Dumbbell, Cable)
-- AND several grips (grip: underhand, overhand/reverse, neutral/hammer). Each
-- combination is its own exercise, so each keeps its own history and PRs; the
-- pickers show "Biceps Curl", then the grip, then the equipment.
alter table exercises
  add column grip text check (grip in ('underhand', 'overhand', 'neutral'));

-- one Biceps Curl family: underhand curls, hammer (neutral) curls, and reverse
-- (overhand) curls
update exercises set variant_group = 'Biceps Curl', grip = 'underhand'
  where name in ('Barbell Curl', 'EZ-Bar Curl', 'Dumbbell Bicep Curl', 'Cable Curl');

update exercises set variant_group = 'Biceps Curl', grip = 'neutral'
  where name in ('Dumbbell Hammer Curl', 'Rope Hammer Curl', 'Single-Arm Cable Hammer Curl');

-- already in use (planned days, saved defaults, programs), so it stays as it is
update exercises set variant_group = 'Biceps Curl', variant_label = 'Standard', grip = 'overhand'
  where name = 'Reverse-Grip Curls';

-- the overhand version of each underhand curl
insert into exercises
  (name, category, primary_muscles, secondary_muscles, weighted, measurement, time_based,
   default_sets, default_rep_min, default_rep_max, is_public,
   equipment, variant_group, variant_label, grip)
values
  ('Reverse Barbell Curl',  'arms', '{biceps}', '{posterior_forearm}', true, 'reps', false, 3,  8, 10, true, 'barbell',  'Biceps Curl', 'Barbell',  'overhand'),
  ('Reverse EZ-Bar Curl',   'arms', '{biceps}', '{posterior_forearm}', true, 'reps', false, 3,  8, 10, true, 'barbell',  'Biceps Curl', 'EZ-bar',   'overhand'),
  ('Reverse Dumbbell Curl', 'arms', '{biceps}', '{posterior_forearm}', true, 'reps', false, 3,  8, 10, true, 'dumbbell', 'Biceps Curl', 'Dumbbell', 'overhand'),
  ('Reverse Cable Curl',    'arms', '{biceps}', '{posterior_forearm}', true, 'reps', false, 3, 12, 15, true, 'cable',    'Biceps Curl', 'Cable',    'overhand');
