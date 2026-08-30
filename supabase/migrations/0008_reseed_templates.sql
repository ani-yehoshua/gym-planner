-- Rebuild the global split presets as 7-slot patterns, each training day
-- populated with a sensible exercise list drawn from the seed catalog by category.
delete from schedule_templates where is_global;

insert into schedule_templates (name, description, default_weeks, is_global) values
 ('Blank','Start from scratch — build your own week.',8,true),
 ('PPL x2','Push / Pull / Legs run twice with one rest day. High training frequency.',8,true),
 ('PPL/UL','Push, Pull, Legs, then Upper / Lower — a rest day between the blocks.',8,true),
 ('PPL + UL','Five straight training days: Push, Pull, Legs, Upper, Lower. Weekend off.',8,true),
 ('Upper/Lower','Four days — Upper and Lower, each twice a week.',8,true),
 ('Bro Split','One muscle group per day, five days on: Chest, Back, Shoulders, Legs, Arms.',8,true),
 ('Body Part Split','Body-part focus with a dedicated arm day: Chest, Back, Shoulders, Arms, Legs.',8,true),
 ('3-Day Full Body','Three full-body days with rest between — good for beginners or a lighter block.',8,true);

insert into template_days (template_id, position, weekday, category, label)
select t.id, d.position, d.position, d.category::muscle_category,
       case when d.category='rest' then 'Rest'
            when d.category='full_body' then 'Full Body'
            else initcap(d.category) end
from schedule_templates t
join (values
 ('PPL x2',0,'push'), ('PPL x2',1,'pull'), ('PPL x2',2,'legs'), ('PPL x2',3,'push'), ('PPL x2',4,'pull'), ('PPL x2',5,'legs'), ('PPL x2',6,'rest'),
 ('PPL/UL',0,'push'), ('PPL/UL',1,'pull'), ('PPL/UL',2,'legs'), ('PPL/UL',3,'rest'), ('PPL/UL',4,'upper'), ('PPL/UL',5,'lower'), ('PPL/UL',6,'rest'),
 ('PPL + UL',0,'push'), ('PPL + UL',1,'pull'), ('PPL + UL',2,'legs'), ('PPL + UL',3,'upper'), ('PPL + UL',4,'lower'), ('PPL + UL',5,'rest'), ('PPL + UL',6,'rest'),
 ('Upper/Lower',0,'upper'), ('Upper/Lower',1,'lower'), ('Upper/Lower',2,'rest'), ('Upper/Lower',3,'upper'), ('Upper/Lower',4,'lower'), ('Upper/Lower',5,'rest'), ('Upper/Lower',6,'rest'),
 ('Bro Split',0,'chest'), ('Bro Split',1,'back'), ('Bro Split',2,'shoulders'), ('Bro Split',3,'legs'), ('Bro Split',4,'arms'), ('Bro Split',5,'rest'), ('Bro Split',6,'rest'),
 ('Body Part Split',0,'chest'), ('Body Part Split',1,'back'), ('Body Part Split',2,'shoulders'), ('Body Part Split',3,'arms'), ('Body Part Split',4,'legs'), ('Body Part Split',5,'rest'), ('Body Part Split',6,'rest'),
 ('3-Day Full Body',0,'full_body'), ('3-Day Full Body',1,'rest'), ('3-Day Full Body',2,'full_body'), ('3-Day Full Body',3,'rest'), ('3-Day Full Body',4,'full_body'), ('3-Day Full Body',5,'rest'), ('3-Day Full Body',6,'rest')
) as d(tname, position, category) on d.tname = t.name
where t.is_global;

insert into template_day_exercises (template_day_id, exercise_id, sort, sets, rep_min, rep_max)
select td.id, e.id, v.sort, v.sets, v.rep_min, v.rep_max
from template_days td
join schedule_templates t on t.id = td.template_id and t.is_global
join (values
 ('push','Barbell Bench Press',0,4,5,8),
 ('push','Incline Dumbbell Press',1,3,8,12),
 ('push','Seated Dumbbell Shoulder Press',2,3,8,12),
 ('push','Lateral Raise',3,3,12,15),
 ('push','Triceps Pushdown',4,3,10,12),
 ('push','Overhead Triceps Extension',5,2,12,15),
 ('pull','Lat Pulldown',0,4,6,10),
 ('pull','Seated Cable Row',1,3,8,12),
 ('pull','Single-Arm Dumbbell Row',2,3,10,12),
 ('pull','Face Pull',3,3,12,20),
 ('pull','Dumbbell Bicep Curl',4,3,10,12),
 ('pull','Hammer Curl',5,2,12,15),
 ('legs','Barbell Back Squat',0,3,5,8),
 ('legs','Romanian Deadlift',1,3,8,10),
 ('legs','Leg Press',2,3,10,15),
 ('legs','Leg Extension',3,3,12,15),
 ('legs','Lying Leg Curl',4,3,12,15),
 ('legs','Standing Calf Raise',5,4,12,15),
 ('upper','Incline Barbell Press',0,4,6,8),
 ('upper','Chest-Supported Row',1,4,8,12),
 ('upper','Wide-Grip Lat Pulldown',2,3,10,12),
 ('upper','Arnold Press',3,3,10,12),
 ('upper','EZ-Bar Curl',4,3,10,12),
 ('upper','Rope Triceps Pushdown',5,3,10,12),
 ('lower','Hip Thrust',0,3,8,10),
 ('lower','Goblet Squat',1,3,10,12),
 ('lower','Bulgarian Split Squat',2,3,10,10),
 ('lower','Seated Leg Curl',3,3,12,15),
 ('lower','Standing Calf Raise',4,3,15,15),
 ('lower','Cable Crunch',5,3,12,15),
 ('full_body','Barbell Back Squat',0,3,5,8),
 ('full_body','Barbell Bench Press',1,3,6,10),
 ('full_body','Barbell Row',2,3,6,10),
 ('full_body','Overhead Barbell Press',3,3,6,10),
 ('full_body','Romanian Deadlift',4,3,8,10),
 ('chest','Barbell Bench Press',0,4,6,10),
 ('chest','Incline Dumbbell Press',1,4,8,12),
 ('chest','Machine Chest Press',2,3,8,12),
 ('chest','Cable Fly',3,3,12,15),
 ('chest','Dips',4,3,8,12),
 ('back','Pull-up',0,4,6,10),
 ('back','Barbell Row',1,4,6,10),
 ('back','Seated Cable Row',2,3,8,12),
 ('back','Single-Arm Dumbbell Row',3,3,10,12),
 ('back','Barbell Shrug',4,3,10,15),
 ('shoulders','Overhead Barbell Press',0,4,6,10),
 ('shoulders','Seated Dumbbell Shoulder Press',1,3,8,12),
 ('shoulders','Lateral Raise',2,4,12,20),
 ('shoulders','Cable Lateral Raise',3,3,12,20),
 ('shoulders','Face Pull',4,3,15,20),
 ('arms','EZ-Bar Curl',0,3,8,12),
 ('arms','Hammer Curl',1,3,10,15),
 ('arms','Preacher Curl',2,3,10,12),
 ('arms','Triceps Pushdown',3,3,10,12),
 ('arms','Overhead Triceps Extension',4,3,10,15),
 ('arms','Dips',5,3,8,12)
) as v(cat, ex_name, sort, sets, rep_min, rep_max) on v.cat::muscle_category = td.category
join exercises e on e.name = v.ex_name and e.created_by is null;
