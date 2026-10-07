-- A superset: exercises done back to back. Stored as a group number shared by
-- the exercises that belong together (unique within a program day / planned
-- day); null = not in a superset. Members are adjacent in the day's order.
alter table program_exercises add column superset_group int;

-- copied onto days planned from a program so the day page can show the grouping
alter table planned_day_exercises add column superset_group int;
