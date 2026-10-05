-- Programs: admin-authored multi-week plans. A program runs for a set number of
-- weeks and has a weekly set target per muscle group (an exercise category,
-- e.g. 6 sets of chest per week). Progress isn't stored — it's counted from
-- the sets a user logs, so there's nothing to keep in sync.
create table programs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  weeks       int not null check (weeks between 1 and 52),
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table program_targets (
  program_id uuid not null references programs(id) on delete cascade,
  category   muscle_category not null,
  sets       int not null check (sets > 0),
  primary key (program_id, category)
);

-- the program a user is currently following (at most one). Week 1 is the
-- Sunday-start week containing start_date, matching the rest of the app.
create table user_programs (
  user_id    uuid primary key references profiles(id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  start_date date not null,
  created_at timestamptz not null default now()
);

alter table programs enable row level security;
alter table program_targets enable row level security;
alter table user_programs enable row level security;

grant select, insert, update, delete on programs, program_targets, user_programs
  to anon, authenticated;

create policy programs_select on programs for select to authenticated using (true);
create policy programs_write on programs for all to authenticated
  using (is_admin()) with check (is_admin());

create policy pt_select on program_targets for select to authenticated using (true);
create policy pt_write on program_targets for all to authenticated
  using (is_admin()) with check (is_admin());

create policy up_own on user_programs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
