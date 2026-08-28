-- GymPlannerApp — seed: global exercise catalog + schedule templates

insert into exercises (name, category, primary_muscles, secondary_muscles, default_sets, default_rep_min, default_rep_max) values
-- PUSH
('Barbell Bench Press',            'push', '{chest}',            '{front_delts,triceps}', 4, 5, 8),
('Incline Dumbbell Press',         'push', '{chest}',            '{front_delts,triceps}', 4, 8, 12),
('Incline Barbell Press',          'push', '{chest}',            '{front_delts,triceps}', 4, 6, 8),
('Machine Chest Press',            'push', '{chest}',            '{front_delts,triceps}', 3, 8, 12),
('Cable Fly',                      'push', '{chest}',            '{front_delts}',         3, 12, 15),
('Overhead Barbell Press',         'push', '{shoulders,front_delts}', '{triceps}',        4, 5, 8),
('Seated Dumbbell Shoulder Press', 'push', '{shoulders,front_delts}', '{triceps}',        3, 8, 12),
('Arnold Press',                   'push', '{shoulders,front_delts}', '{triceps}',        3, 10, 12),
('Lateral Raise',                  'push', '{side_delts}',       '{}',                    3, 12, 15),
('Cable Lateral Raise',            'push', '{side_delts}',       '{}',                    2, 12, 20),
('Triceps Pushdown',               'push', '{triceps}',          '{}',                    3, 10, 12),
('Rope Triceps Pushdown',          'push', '{triceps}',          '{}',                    2, 12, 15),
('Overhead Triceps Extension',     'push', '{triceps}',          '{}',                    2, 12, 15),
('Dips',                           'push', '{chest,triceps}',    '{front_delts}',         3, 6, 12),
-- PULL
('Pull-up',                        'pull', '{lats,back}',        '{biceps}',              4, 5, 10),
('Assisted Pull-up',               'pull', '{lats,back}',        '{biceps}',              4, 6, 10),
('Lat Pulldown',                   'pull', '{lats,back}',        '{biceps}',              4, 8, 12),
('Wide-Grip Lat Pulldown',         'pull', '{lats}',             '{biceps}',              3, 10, 12),
('Barbell Row',                    'pull', '{back,lats}',        '{biceps,rear_delts}',   4, 6, 10),
('Seated Cable Row',               'pull', '{back}',             '{biceps,rear_delts}',   4, 8, 10),
('Chest-Supported Row',            'pull', '{back}',             '{biceps,rear_delts}',   4, 8, 12),
('Single-Arm Dumbbell Row',        'pull', '{back,lats}',        '{biceps}',              3, 10, 12),
('Face Pull',                      'pull', '{rear_delts,traps}', '{}',                    2, 12, 20),
('Barbell Shrug',                  'pull', '{traps}',            '{}',                    3, 10, 15),
('Dumbbell Bicep Curl',            'pull', '{biceps}',           '{forearms}',            3, 10, 12),
('EZ-Bar Curl',                    'pull', '{biceps}',           '{forearms}',            2, 10, 12),
('Hammer Curl',                    'pull', '{biceps,forearms}',  '{}',                    2, 12, 15),
('Preacher Curl',                  'pull', '{biceps}',           '{}',                    3, 10, 12),
-- LEGS / LOWER
('Barbell Back Squat',             'legs', '{quads,glutes}',     '{hamstrings,lower_back}', 3, 5, 8),
('Front Squat',                    'legs', '{quads}',            '{glutes}',              3, 6, 10),
('Goblet Squat',                   'legs', '{quads,glutes}',     '{}',                    3, 10, 15),
('Leg Press',                      'legs', '{quads,glutes}',     '{hamstrings}',          3, 8, 15),
('Romanian Deadlift',              'legs', '{hamstrings,glutes}','{lower_back}',          3, 8, 10),
('Conventional Deadlift',          'legs', '{hamstrings,glutes,back}', '{lower_back,traps}', 3, 3, 6),
('Hip Thrust',                     'legs', '{glutes}',           '{hamstrings}',          3, 8, 12),
('Bulgarian Split Squat',          'legs', '{quads,glutes}',     '{hamstrings}',          3, 8, 12),
('Walking Lunge',                  'legs', '{quads,glutes}',     '{hamstrings}',          2, 10, 12),
('Leg Extension',                  'legs', '{quads}',            '{}',                    3, 12, 15),
('Lying Leg Curl',                 'legs', '{hamstrings}',       '{}',                    3, 10, 15),
('Seated Leg Curl',                'legs', '{hamstrings}',       '{}',                    3, 12, 15),
('Standing Calf Raise',            'legs', '{calves}',           '{}',                    3, 12, 15),
('Seated Calf Raise',              'legs', '{calves}',           '{}',                    3, 12, 20),
('Hip Adduction Machine',          'legs', '{adductors}',        '{}',                    3, 12, 20),
-- CORE
('Cable Crunch',                   'core', '{abs}',              '{}',                    3, 12, 15),
('Weighted Plank',                 'core', '{abs,lower_back}',   '{}',                    3, 30, 60),
('Hanging Leg Raise',              'core', '{abs}',              '{}',                    3, 10, 15),
('Ab Wheel Rollout',               'core', '{abs}',              '{}',                    3, 8, 12),
-- CARDIO
('Incline Treadmill Walk',         'cardio', '{cardio}',         '{}',                    1, 15, 30),
('Stationary Bike',                'cardio', '{cardio}',         '{}',                    1, 15, 30),
('Rowing Machine',                 'cardio', '{cardio}',         '{}',                    1, 10, 20),
('Stairmaster',                    'cardio', '{cardio}',         '{}',                    1, 10, 20);

-- ---------------------------------------------------------------------------
-- Template: Blank
-- ---------------------------------------------------------------------------
insert into schedule_templates (name, description, default_weeks, is_global)
values ('Blank', 'Start from scratch. No days, no exercises — build your own split.', 8, true);

-- ---------------------------------------------------------------------------
-- Template: 5-Day PPLUL (from the Gym Training Tracker sheet)
-- ---------------------------------------------------------------------------
with tmpl as (
  insert into schedule_templates (name, description, default_weeks, is_global)
  values (
    '5-Day PPLUL',
    'Push / Pull / Legs / Upper / Lower, Tue–Sat. Hypertrophy focus, first lift each day is strength (5–8), the rest is size (8–15).',
    8, true
  )
  returning id
),
days as (
  insert into template_days (template_id, weekday, category, label, sort)
  select tmpl.id, x.weekday, x.category, x.label, x.sort
  from tmpl, (values
    (2, 'push'::muscle_category,  'Push',  0),
    (3, 'pull'::muscle_category,  'Pull',  1),
    (4, 'legs'::muscle_category,  'Legs',  2),
    (5, 'upper'::muscle_category, 'Upper', 3),
    (6, 'lower'::muscle_category, 'Lower', 4)
  ) as x(weekday, category, label, sort)
  returning id, label
)
insert into template_day_exercises (template_day_id, exercise_id, sort, sets, rep_min, rep_max)
select d.id, e.id, v.sort, v.sets, v.rep_min, v.rep_max
from days d
join (values
  ('Push',  'Barbell Bench Press',            0, 4, 5, 8),
  ('Push',  'Incline Dumbbell Press',         1, 4, 8, 12),
  ('Push',  'Seated Dumbbell Shoulder Press', 2, 3, 8, 12),
  ('Push',  'Lateral Raise',                  3, 2, 12, 15),
  ('Push',  'Triceps Pushdown',               4, 3, 10, 12),
  ('Push',  'Overhead Triceps Extension',     5, 2, 12, 15),
  ('Pull',  'Lat Pulldown',                   0, 4, 6, 8),
  ('Pull',  'Seated Cable Row',               1, 4, 8, 10),
  ('Pull',  'Single-Arm Dumbbell Row',        2, 3, 10, 12),
  ('Pull',  'Face Pull',                      3, 2, 12, 15),
  ('Pull',  'Dumbbell Bicep Curl',            4, 3, 10, 12),
  ('Pull',  'Hammer Curl',                    5, 2, 12, 15),
  ('Legs',  'Barbell Back Squat',             0, 3, 5, 8),
  ('Legs',  'Romanian Deadlift',              1, 3, 8, 10),
  ('Legs',  'Leg Extension',                  2, 3, 12, 15),
  ('Legs',  'Lying Leg Curl',                 3, 3, 12, 15),
  ('Legs',  'Walking Lunge',                  4, 2, 10, 10),
  ('Legs',  'Standing Calf Raise',            5, 3, 12, 15),
  ('Upper', 'Incline Barbell Press',          0, 4, 6, 8),
  ('Upper', 'Chest-Supported Row',            1, 4, 8, 12),
  ('Upper', 'Wide-Grip Lat Pulldown',         2, 3, 10, 12),
  ('Upper', 'Arnold Press',                   3, 3, 10, 12),
  ('Upper', 'Cable Lateral Raise',            4, 2, 12, 15),
  ('Upper', 'EZ-Bar Curl',                    5, 2, 12, 12),
  ('Upper', 'Rope Triceps Pushdown',          6, 2, 12, 12),
  ('Lower', 'Hip Thrust',                     0, 3, 8, 10),
  ('Lower', 'Goblet Squat',                   1, 3, 10, 12),
  ('Lower', 'Bulgarian Split Squat',          2, 3, 10, 10),
  ('Lower', 'Seated Leg Curl',                3, 3, 12, 15),
  ('Lower', 'Standing Calf Raise',            4, 3, 15, 15),
  ('Lower', 'Cable Crunch',                   5, 3, 12, 15)
) as v(day_label, ex_name, sort, sets, rep_min, rep_max) on v.day_label = d.label
join exercises e on e.name = v.ex_name and e.created_by is null;

-- ---------------------------------------------------------------------------
-- Template: 3-Day Full Body
-- ---------------------------------------------------------------------------
with tmpl as (
  insert into schedule_templates (name, description, default_weeks, is_global)
  values ('3-Day Full Body', 'Mon / Wed / Fri full-body. Good for beginners or a lighter week.', 8, true)
  returning id
),
days as (
  insert into template_days (template_id, weekday, category, label, sort)
  select tmpl.id, x.weekday, 'full_body'::muscle_category, x.label, x.sort
  from tmpl, (values (1, 'Full Body A', 0), (3, 'Full Body B', 1), (5, 'Full Body C', 2))
  as x(weekday, label, sort)
  returning id, label
)
insert into template_day_exercises (template_day_id, exercise_id, sort, sets, rep_min, rep_max)
select d.id, e.id, v.sort, v.sets, v.rep_min, v.rep_max
from days d
join (values
  ('Full Body A', 'Barbell Back Squat',   0, 3, 5, 8),
  ('Full Body A', 'Barbell Bench Press',  1, 3, 6, 10),
  ('Full Body A', 'Seated Cable Row',     2, 3, 8, 12),
  ('Full Body A', 'Lateral Raise',        3, 3, 12, 15),
  ('Full Body A', 'Standing Calf Raise',  4, 3, 12, 15),
  ('Full Body B', 'Romanian Deadlift',    0, 3, 6, 10),
  ('Full Body B', 'Overhead Barbell Press', 1, 3, 6, 10),
  ('Full Body B', 'Lat Pulldown',         2, 3, 8, 12),
  ('Full Body B', 'Leg Press',            3, 3, 10, 15),
  ('Full Body B', 'EZ-Bar Curl',          4, 3, 10, 12),
  ('Full Body C', 'Hip Thrust',           0, 3, 8, 12),
  ('Full Body C', 'Incline Dumbbell Press', 1, 3, 8, 12),
  ('Full Body C', 'Barbell Row',          2, 3, 6, 10),
  ('Full Body C', 'Leg Extension',        3, 3, 12, 15),
  ('Full Body C', 'Triceps Pushdown',     4, 3, 10, 12)
) as v(day_label, ex_name, sort, sets, rep_min, rep_max) on v.day_label = d.label
join exercises e on e.name = v.ex_name and e.created_by is null;
