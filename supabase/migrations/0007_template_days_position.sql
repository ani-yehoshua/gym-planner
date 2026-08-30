-- Templates become an ordered 7-slot pattern (position 0..6) instead of a fixed
-- weekday, so the user can reorder slots and apply from any start date.
alter table template_days add column if not exists position integer;

update template_days td
set position = sub.rn
from (
  select id, (row_number() over (partition by template_id order by weekday, sort) - 1) as rn
  from template_days
) sub
where sub.id = td.id and td.position is null;

alter table template_days alter column position set default 0;
alter table template_days alter column position set not null;
alter table template_days drop constraint if exists template_days_weekday_check;
alter table template_days alter column weekday drop not null;
