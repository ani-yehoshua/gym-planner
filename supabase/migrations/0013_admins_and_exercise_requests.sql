-- Admin identity (seeded via migration / service role, never self-serve) + a
-- "request an exercise" queue for non-admin users.
create table admins (
  user_id uuid primary key references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;
grant select on admins to anon, authenticated;
create policy admins_select on admins for select to authenticated using (true);

-- seed the first admin (Joshua). Add more with:
--   insert into admins (user_id) select id from auth.users where email = '...';
insert into admins (user_id) values ('d38be18a-cac9-4470-9a12-28d5631ae983')
on conflict do nothing;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;
revoke all on function is_admin() from anon;

-- exercises: only admins may create public catalog entries
drop policy if exists ex_insert on exercises;
create policy ex_insert on exercises for insert to authenticated
with check (
  created_by = auth.uid()
  and (is_public = false or is_admin())
);

create table exercise_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete set null,
  name       text not null,
  note       text,
  status     text not null default 'open',   -- open | done | dismissed
  created_at timestamptz not null default now()
);
alter table exercise_requests enable row level security;
grant select, insert, update, delete on exercise_requests to anon, authenticated;
create policy er_insert on exercise_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy er_select_own on exercise_requests for select to authenticated
  using (user_id = auth.uid());
create policy er_admin_all on exercise_requests for all to authenticated
  using (is_admin()) with check (is_admin());
