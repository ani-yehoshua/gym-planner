-- Programs don't roll forward on their own after all (0046's automatic shift
-- is dropped). Instead a member can slide a program day, and the days after it
-- in the same program week, later by a day or more: Thanksgiving's Thursday
-- and Friday become Friday and Saturday, and the following weeks stay
-- Monday–Friday. A slide has to fit before next week's first day.
drop function if exists roll_missed_program_days(date);

create function slide_program_week(p_day uuid, p_days int) returns void
language plpgsql security definer set search_path = public as $$
declare
  d record;
  wk_end int;
  next_first date;
  last_new date;
begin
  if p_days is null or p_days < 1 or p_days > 6 then
    raise exception 'Slide by 1 to 6 days.';
  end if;
  select id, date, program_run_id, program_day_number, owner_user, party_id
    into d from planned_days where id = p_day;
  if d.id is null or d.program_run_id is null or d.program_day_number is null then
    raise exception 'That isn''t a program day.';
  end if;
  if not (d.owner_user = auth.uid()
          or (d.party_id is not null and is_party_member(d.party_id))) then
    raise exception 'That day isn''t yours to move.';
  end if;

  -- the program week this day belongs to: days 1-7, 8-14, ...
  wk_end := ((d.program_day_number - 1) / 7 + 1) * 7;

  -- this day and the rest of its week move, apart from any already logged
  select max(x.date) + p_days into last_new from planned_days x
  where x.program_run_id = d.program_run_id
    and x.program_day_number between d.program_day_number and wk_end
    and not exists (
      select 1 from planned_day_exercises e
      join set_logs s on s.planned_day_exercise_id = e.id
      where e.planned_day_id = x.id);
  if last_new is null then
    raise exception 'Those days are already logged.';
  end if;

  select min(x.date) into next_first from planned_days x
  where x.program_run_id = d.program_run_id and x.program_day_number > wk_end;
  if next_first is not null and last_new >= next_first then
    raise exception 'That would run into next week (%). Slide by fewer days.',
      to_char(next_first, 'Dy Mon FMDD');
  end if;

  update planned_days x set date = x.date + p_days
  where x.program_run_id = d.program_run_id
    and x.program_day_number between d.program_day_number and wk_end
    and not exists (
      select 1 from planned_day_exercises e
      join set_logs s on s.planned_day_exercise_id = e.id
      where e.planned_day_id = x.id);
end $$;

revoke all on function slide_program_week(uuid, int) from public, anon;
grant execute on function slide_program_week(uuid, int) to authenticated;
