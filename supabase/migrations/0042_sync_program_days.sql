-- Editing a program used to change only the program: days already planned from
-- it (copied when someone started it) kept the old exercises, sets and reps.
-- This brings every upcoming planned day of a program back in line with the
-- program as it's now defined. Days before today are left as history; logged
-- sets are never deleted.

create function _sync_program_days(p_program uuid, p_actor uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  cyc_len int;
  synced int := 0;
  d record;
  cd record;
  pe record;
  existing uuid;
  v_sets int;
  v_min int;
  v_max int;
  v_set_reps jsonb;
  j int;
begin
  select count(*) into cyc_len from program_days where program_id = p_program;
  if cyc_len = 0 then return 0; end if;

  for d in
    select id, program_day_number from planned_days
    where program_id = p_program
      and program_day_number is not null
      and date >= current_date - 1
  loop
    -- the day of the cycle this date falls on
    select id, name, is_rest into cd from program_days
      where program_id = p_program
      order by position
      offset ((d.program_day_number - 1) % cyc_len) limit 1;
    if cd.is_rest then continue; end if;

    update planned_days set label = cd.name where id = d.id;

    j := 0;
    for pe in
      select e.exercise_id, e.sets, e.rep_min, e.rep_max, e.set_reps, e.superset_group,
             x.default_sets, x.default_rep_min, x.default_rep_max
      from program_exercises e
      join exercises x on x.id = e.exercise_id
      where e.program_day_id = cd.id
      order by e.sort
    loop
      v_sets := coalesce(pe.sets, pe.default_sets, 2);
      v_min := coalesce(pe.rep_min, pe.default_rep_min);
      v_max := coalesce(pe.rep_max, pe.default_rep_max);
      v_set_reps := case
        when jsonb_typeof(pe.set_reps) = 'array' and jsonb_array_length(pe.set_reps) > 0
        then pe.set_reps else null end;

      select id into existing from planned_day_exercises
        where planned_day_id = d.id and exercise_id = pe.exercise_id and from_program
        limit 1;
      if existing is not null then
        update planned_day_exercises set
          sort = j, target_sets = v_sets, target_rep_min = v_min, target_rep_max = v_max,
          program_set_reps = v_set_reps, superset_group = pe.superset_group
        where id = existing;
        -- the program's numbers are the ones shown, so old personal copies of
        -- them (written when the program was started) must not mask the edit
        update day_exercise_user_targets
          set target_sets = null, target_rep_min = null, target_rep_max = null
          where planned_day_exercise_id = existing;
      else
        insert into planned_day_exercises
          (planned_day_id, exercise_id, sort, target_sets, target_rep_min, target_rep_max,
           from_program, program_set_reps, superset_group, added_by)
        values
          (d.id, pe.exercise_id, j, v_sets, v_min, v_max, true, v_set_reps,
           pe.superset_group, p_actor);
      end if;
      j := j + 1;
    end loop;

    -- exercises taken out of the program's day, unless something was logged
    delete from planned_day_exercises x
      where x.planned_day_id = d.id and x.from_program
        and not exists (
          select 1 from program_exercises e
          where e.program_day_id = cd.id and e.exercise_id = x.exercise_id)
        and not exists (select 1 from set_logs s where s.planned_day_exercise_id = x.id);

    synced := synced + 1;
  end loop;
  return synced;
end $$;

revoke all on function _sync_program_days(uuid, uuid) from public, anon, authenticated;

create function sync_program_days(p_program uuid) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return _sync_program_days(p_program, auth.uid());
end $$;

revoke all on function sync_program_days(uuid) from public, anon;
grant execute on function sync_program_days(uuid) to authenticated;
