-- (Superseded by 0047: the automatic roll-forward below was dropped there.)
-- Programs behave like reading plans: a program day that goes by with nothing
-- logged isn't left behind. The next time the app is opened it's moved to
-- today, and every later day of that run that hasn't been logged slides back
-- by the same amount (so rest days keep their spacing). The program waits at
-- the missed day until it's done.
--
-- Each start of a program is a run; its planned days share a run id so they
-- can be moved together. A party's run counts a day as done when any member
-- has logged on it.
alter table planned_days add column program_run_id uuid;
create index planned_days_program_run_idx on planned_days (program_run_id);

-- runs still going get an id (one per member or party, per program); finished
-- ones are left as history and never move
with g as (
  select coalesce(owner_user::text, party_id::text) as who, program_id,
         gen_random_uuid() as rid
  from planned_days
  where program_id is not null
  group by 1, 2
  having max(date) >= current_date
)
update planned_days d set program_run_id = g.rid
from g
where d.program_id = g.program_id
  and coalesce(d.owner_user::text, d.party_id::text) = g.who;

create function roll_missed_program_days(p_today date) returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  missed date;
  delta int;
  rolled int := 0;
  v_program uuid;
  v_owner uuid;
begin
  if auth.uid() is null then return 0; end if;

  for r in
    select distinct d.program_run_id as rid from planned_days d
    where d.program_run_id is not null
      and d.date < p_today
      and (d.owner_user = auth.uid()
           or (d.party_id is not null and is_party_member(d.party_id)))
  loop
    -- the earliest day of the run that's gone by with nothing logged
    select min(d.date) into missed from planned_days d
    where d.program_run_id = r.rid and d.date < p_today
      and not exists (
        select 1 from planned_day_exercises x
        join set_logs s on s.planned_day_exercise_id = x.id
        where x.planned_day_id = d.id);
    if missed is null then continue; end if;

    delta := p_today - missed;
    update planned_days d set date = d.date + delta
    where d.program_run_id = r.rid and d.date >= missed
      and not exists (
        select 1 from planned_day_exercises x
        join set_logs s on s.planned_day_exercise_id = x.id
        where x.planned_day_id = d.id);

    -- a program you follow yourself ends that much later too
    select program_id, owner_user into v_program, v_owner
    from planned_days where program_run_id = r.rid limit 1;
    if v_owner is not null then
      update user_programs set end_date = end_date + delta
      where user_id = v_owner and program_id = v_program;
    end if;
    rolled := rolled + 1;
  end loop;
  return rolled;
end $$;

revoke all on function roll_missed_program_days(date) from public, anon;
grant execute on function roll_missed_program_days(date) to authenticated;
