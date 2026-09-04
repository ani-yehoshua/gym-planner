-- Some exercises are timed (holds, cardio) instead of rep-based: N sets of a
-- chosen duration. Reuse the existing rep_min/rep_max/target fields to store
-- seconds when this flag is set — only the UI label changes.
alter table exercises add column time_based boolean not null default false;

update exercises set time_based = true
where name in ('Weighted Plank', 'Wall Sit')
   or category = 'cardio';
