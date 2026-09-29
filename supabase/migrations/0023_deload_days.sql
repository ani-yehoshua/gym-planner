-- A day can be flagged as a deload day (toggle in the UI). Purely a marker —
-- weights logged on a deload day are ordinary set_logs rows, so history and
-- PRs don't need special-casing beyond showing the badge.
alter table planned_days add column is_deload boolean not null default false;
