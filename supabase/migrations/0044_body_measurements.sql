-- Tape measurements, logged alongside bodyweight. One row per member per date;
-- any site can be left blank. Lengths are stored in centimetres whatever the
-- member's units, and converted to inches for pounds users when shown.
create table body_measurements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  date       date not null,
  waist      numeric check (waist > 0),
  neck       numeric check (neck > 0),
  upper_arm  numeric check (upper_arm > 0),
  forearm    numeric check (forearm > 0),
  chest      numeric check (chest > 0),
  thigh      numeric check (thigh > 0),
  calf       numeric check (calf > 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table body_measurements enable row level security;
grant select, insert, update, delete on body_measurements to authenticated;
create policy bm_own on body_measurements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
