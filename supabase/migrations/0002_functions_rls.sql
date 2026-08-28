-- GymPlannerApp — functions, triggers, row-level security

-- ---------------------------------------------------------------------------
-- new user -> profile + constants row
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.user_constants (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger user_constants_touch
  before update on user_constants
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- party helpers
-- ---------------------------------------------------------------------------
create or replace function is_party_member(p_party uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from party_members
    where party_id = p_party and user_id = auth.uid()
  );
$$;

create or replace function is_party_owner(p_party uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from party_members
    where party_id = p_party and user_id = auth.uid() and role = 'owner'
  );
$$;

-- creator becomes owner member
create or replace function handle_new_party()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.party_members (party_id, user_id, role)
  values (new.id, coalesce(new.created_by, auth.uid()), 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_party_created
  after insert on parties
  for each row execute function handle_new_party();

-- join by invite code (bypasses RLS via security definer, does its own checks)
create or replace function join_party_with_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invite party_invites;
begin
  select * into v_invite from party_invites where code = p_code;
  if not found then
    raise exception 'invalid invite code';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite code expired';
  end if;
  if v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses then
    raise exception 'invite code exhausted';
  end if;

  insert into party_members (party_id, user_id, role)
  values (v_invite.party_id, auth.uid(), 'member')
  on conflict (party_id, user_id) do nothing;

  update party_invites set uses = uses + 1 where id = v_invite.id;
  return v_invite.party_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table profiles              enable row level security;
alter table user_constants        enable row level security;
alter table exercises             enable row level security;
alter table schedule_templates    enable row level security;
alter table template_days         enable row level security;
alter table template_day_exercises enable row level security;
alter table parties               enable row level security;
alter table party_members         enable row level security;
alter table party_invites         enable row level security;
alter table planned_days          enable row level security;
alter table planned_day_exercises enable row level security;
alter table set_logs              enable row level security;
alter table bodyweight_logs       enable row level security;

-- profiles: everyone signed in can read (names/avatars); write self only
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- user_constants: self only
create policy uc_all on user_constants for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- exercises: public seeds + own customs
create policy ex_select on exercises for select to authenticated
  using (is_public or created_by = auth.uid());
create policy ex_insert on exercises for insert to authenticated
  with check (created_by = auth.uid());
create policy ex_update on exercises for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy ex_delete on exercises for delete to authenticated
  using (created_by = auth.uid());

-- templates: global seeds + own
create policy st_select on schedule_templates for select to authenticated
  using (is_global or created_by = auth.uid());
create policy st_write on schedule_templates for all to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy td_select on template_days for select to authenticated using (
  exists (select 1 from schedule_templates t
          where t.id = template_id and (t.is_global or t.created_by = auth.uid())));
create policy td_write on template_days for all to authenticated using (
  exists (select 1 from schedule_templates t where t.id = template_id and t.created_by = auth.uid()))
  with check (
  exists (select 1 from schedule_templates t where t.id = template_id and t.created_by = auth.uid()));

create policy tde_select on template_day_exercises for select to authenticated using (
  exists (select 1 from template_days d join schedule_templates t on t.id = d.template_id
          where d.id = template_day_id and (t.is_global or t.created_by = auth.uid())));
create policy tde_write on template_day_exercises for all to authenticated using (
  exists (select 1 from template_days d join schedule_templates t on t.id = d.template_id
          where d.id = template_day_id and t.created_by = auth.uid()))
  with check (
  exists (select 1 from template_days d join schedule_templates t on t.id = d.template_id
          where d.id = template_day_id and t.created_by = auth.uid()));

-- parties: members, owners, or open parties are visible
create policy party_select on parties for select to authenticated
  using (is_party_member(id) or created_by = auth.uid() or invite_type = 'open');
create policy party_insert on parties for insert to authenticated
  with check (created_by = auth.uid());
create policy party_update on parties for update to authenticated
  using (is_party_owner(id)) with check (is_party_owner(id));
create policy party_delete on parties for delete to authenticated
  using (is_party_owner(id));

-- party_members
create policy pm_select on party_members for select to authenticated
  using (is_party_member(party_id));
create policy pm_insert on party_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from parties p where p.id = party_id and p.invite_type = 'open')
  );
create policy pm_delete on party_members for delete to authenticated
  using (user_id = auth.uid() or is_party_owner(party_id));

-- party_invites: members read, owners manage
create policy pi_select on party_invites for select to authenticated
  using (is_party_member(party_id));
create policy pi_write on party_invites for all to authenticated
  using (is_party_owner(party_id)) with check (is_party_owner(party_id));

-- planned_days
create policy pd_select on planned_days for select to authenticated
  using (owner_user = auth.uid() or is_party_member(party_id));
create policy pd_insert on planned_days for insert to authenticated
  with check (
    (owner_user = auth.uid() and party_id is null)
    or (party_id is not null and owner_user is null and is_party_member(party_id))
  );
create policy pd_update on planned_days for update to authenticated
  using (owner_user = auth.uid() or is_party_member(party_id))
  with check (owner_user = auth.uid() or is_party_member(party_id));
create policy pd_delete on planned_days for delete to authenticated
  using (owner_user = auth.uid() or is_party_owner(party_id));

-- planned_day_exercises: follow parent day visibility
create policy pde_select on planned_day_exercises for select to authenticated using (
  exists (select 1 from planned_days d where d.id = planned_day_id
          and (d.owner_user = auth.uid() or is_party_member(d.party_id))));
create policy pde_write on planned_day_exercises for all to authenticated using (
  exists (select 1 from planned_days d where d.id = planned_day_id
          and (d.owner_user = auth.uid() or is_party_member(d.party_id))))
  with check (
  exists (select 1 from planned_days d where d.id = planned_day_id
          and (d.owner_user = auth.uid() or is_party_member(d.party_id))));

-- set_logs: your own always; party co-members can read
create policy sl_select on set_logs for select to authenticated using (
  user_id = auth.uid()
  or exists (
    select 1 from planned_day_exercises pde
    join planned_days d on d.id = pde.planned_day_id
    where pde.id = planned_day_exercise_id and is_party_member(d.party_id)
  )
);
create policy sl_write on set_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- bodyweight: self only
create policy bw_all on bodyweight_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
