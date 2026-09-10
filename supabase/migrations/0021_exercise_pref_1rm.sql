-- Per-user estimated 1RM for an exercise, alongside the working weight.
-- The two are kept in sync in the UI via Epley (1RM = w * (1 + reps/30)); this
-- column just stores whichever the user landed on.
alter table user_exercise_prefs add column default_1rm numeric;
