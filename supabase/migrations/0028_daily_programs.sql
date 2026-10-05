-- Programs are now single-day sessions ("Push Day", "Pull Day"…): an admin
-- builds one like planning a session — a type plus an ordered list of exercises
-- with optional sets and rep ranges (program_exercises) — and a member can pick
-- it when planning a day to get that day filled in.
--
-- That replaces the earlier multi-week idea, so the weekly set targets and the
-- "follow a program" tracking go away.
drop table if exists user_programs;
drop table if exists program_targets;

alter table programs drop column weeks;
-- the session type, same values as a planned day's category (null = Mix)
alter table programs add column category muscle_category;
