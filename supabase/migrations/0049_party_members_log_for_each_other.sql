-- On a shared party day, any member can enter sets, reps, weights and targets
-- for any other member of that party (one person logging for the group).
-- Limited to party days, and to members of that day's party on both ends.
create policy sl_party_write on set_logs for all to authenticated
  using (exists (
    select 1 from planned_day_exercises pde
    join planned_days d on d.id = pde.planned_day_id
    join party_members pm on pm.party_id = d.party_id and pm.user_id = set_logs.user_id
    where pde.id = set_logs.planned_day_exercise_id and is_party_member(d.party_id)))
  with check (exists (
    select 1 from planned_day_exercises pde
    join planned_days d on d.id = pde.planned_day_id
    join party_members pm on pm.party_id = d.party_id and pm.user_id = set_logs.user_id
    where pde.id = set_logs.planned_day_exercise_id and is_party_member(d.party_id)));

create policy deut_party on day_exercise_user_targets for all to authenticated
  using (exists (
    select 1 from planned_day_exercises pde
    join planned_days d on d.id = pde.planned_day_id
    join party_members pm on pm.party_id = d.party_id and pm.user_id = day_exercise_user_targets.user_id
    where pde.id = day_exercise_user_targets.planned_day_exercise_id and is_party_member(d.party_id)))
  with check (exists (
    select 1 from planned_day_exercises pde
    join planned_days d on d.id = pde.planned_day_id
    join party_members pm on pm.party_id = d.party_id and pm.user_id = day_exercise_user_targets.user_id
    where pde.id = day_exercise_user_targets.planned_day_exercise_id and is_party_member(d.party_id)));

-- so the member logging for someone sees that person's own sets/reps/weight
-- defaults, the same numbers they'd see themselves
create policy uep_party_read on user_exercise_prefs for select to authenticated
  using (exists (
    select 1 from party_members a
    join party_members b on b.party_id = a.party_id
    where a.user_id = auth.uid() and b.user_id = user_exercise_prefs.user_id));
