-- A member can mark an exercise on a session as a 1RM attempt (their own mark,
-- like their own targets). The heaviest single logged on a marked exercise
-- counts as a tested 1RM, whatever kind of day it is.
alter table day_exercise_user_targets
  add column is_one_rm boolean not null default false;
