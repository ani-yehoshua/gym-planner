-- Human-readable admin list (mirror of the ADMIN_EMAILS env var). is_admin()
-- now grants admin by seeded user_id OR by auth email in this table.
create table admin_emails (email text primary key);
alter table admin_emails enable row level security;
grant select on admin_emails to authenticated;
-- no write policy: managed via migrations / service role

-- keep in sync with ADMIN_EMAILS in the app env
insert into admin_emails (email) values
  ('yehoshua.ani@gmail.com'),
  ('jasone1027@gmail.com')
on conflict do nothing;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from admins where user_id = auth.uid())
    or exists (
      select 1 from admin_emails
      where email = lower(auth.jwt() ->> 'email')
    );
$$;
revoke all on function is_admin() from anon;
grant execute on function is_admin() to authenticated;
