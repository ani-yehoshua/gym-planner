-- Per-user current working weight for an exercise (like sets / rep range).
alter table user_exercise_prefs add column default_weight numeric;

-- Prefilled onto a planned exercise when added to a day (shown as "current weight"
-- and as the placeholder for every set's weight field).
alter table planned_day_exercises add column target_weight numeric;

-- Exercise muscle targets become free-form text[] so any target can be added
-- (front delts, traps, or a fully custom string), not just the muscle_group enum.
alter table exercises alter column primary_muscles drop default;
alter table exercises alter column secondary_muscles drop default;
alter table exercises
  alter column primary_muscles type text[] using primary_muscles::text[],
  alter column secondary_muscles type text[] using secondary_muscles::text[];
alter table exercises alter column primary_muscles set default '{}'::text[];
alter table exercises alter column secondary_muscles set default '{}'::text[];
