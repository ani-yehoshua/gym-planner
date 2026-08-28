-- GymPlannerApp — Phase 1 schema
-- Core primitive: planned_day (a dated training session, owned by a user OR a party).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
create type muscle_category   as enum ('push','pull','legs','upper','lower','full_body','core','cardio','custom','rest');
create type party_invite_type as enum ('open','invite_only');
create type party_role        as enum ('owner','member');
create type experience_level  as enum ('beginner','returning','intermediate','advanced');
create type unit_system       as enum ('lb','kg');
create type muscle_group      as enum (
  'chest','back','lats','traps','shoulders','front_delts','side_delts','rear_delts',
  'biceps','triceps','forearms','quads','hamstrings','glutes','calves','adductors',
  'abs','lower_back','neck','cardio','full_body','other'
);

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url   text,
  units        unit_system not null default 'lb',
  timezone     text not null default 'America/Chicago',
  onboarded_at timestamptz,
  created_at   timestamptz not null default now()
);

create table user_constants (
  user_id             uuid primary key references profiles(id) on delete cascade,
  experience          experience_level,
  primary_goal        text,            -- build_muscle | get_stronger | lose_fat | general_fitness
  focus_muscles       muscle_group[] not null default '{}',
  current_bodyweight  numeric,
  target_bodyweight   numeric,
  weekly_gain_target  numeric,         -- lb (or kg) per week, can be negative for a cut
  weekly_set_targets  jsonb not null default '{}'::jsonb,   -- { "chest": 12, "back": 14, ... }
  calorie_target      integer,
  protein_target      integer,
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- exercise catalog
-- ---------------------------------------------------------------------------
create table exercises (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  category          muscle_category not null,
  primary_muscles   muscle_group[] not null default '{}',
  secondary_muscles muscle_group[] not null default '{}',
  default_sets      integer,
  default_rep_min   integer,
  default_rep_max   integer,
  howto_text        text,
  media_url         text,
  created_by        uuid references profiles(id) on delete set null,  -- null = global seed
  is_public         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index exercises_category_idx on exercises (category);
create index exercises_created_by_idx on exercises (created_by);

-- ---------------------------------------------------------------------------
-- schedule templates
-- ---------------------------------------------------------------------------
create table schedule_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  default_weeks integer not null default 8,
  is_global     boolean not null default true,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table template_days (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references schedule_templates(id) on delete cascade,
  weekday     integer not null check (weekday between 0 and 6),  -- 0 = Sunday
  category    muscle_category not null,
  label       text,
  sort        integer not null default 0
);

create table template_day_exercises (
  id              uuid primary key default gen_random_uuid(),
  template_day_id uuid not null references template_days(id) on delete cascade,
  exercise_id     uuid not null references exercises(id) on delete cascade,
  sort            integer not null default 0,
  sets            integer,
  rep_min         integer,
  rep_max         integer
);

-- ---------------------------------------------------------------------------
-- parties (training groups / lobbies)
-- ---------------------------------------------------------------------------
create table parties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_type party_invite_type not null default 'invite_only',
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table party_members (
  party_id  uuid not null references parties(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      party_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);
create index party_members_user_idx on party_members (user_id);

create table party_invites (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references parties(id) on delete cascade,
  code       text not null unique,
  created_by uuid references profiles(id) on delete set null,
  expires_at timestamptz,
  max_uses   integer,
  uses       integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- the calendar
-- ---------------------------------------------------------------------------
create table planned_days (
  id         uuid primary key default gen_random_uuid(),
  owner_user uuid references profiles(id) on delete cascade,
  party_id   uuid references parties(id) on delete cascade,
  date       date not null,
  category   muscle_category,
  label      text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint planned_day_single_owner
    check ((owner_user is not null) <> (party_id is not null))
);
create index planned_days_owner_date_idx on planned_days (owner_user, date);
create index planned_days_party_date_idx on planned_days (party_id, date);

create table planned_day_exercises (
  id              uuid primary key default gen_random_uuid(),
  planned_day_id  uuid not null references planned_days(id) on delete cascade,
  exercise_id     uuid not null references exercises(id) on delete restrict,
  sort            integer not null default 0,
  target_sets     integer,
  target_rep_min  integer,
  target_rep_max  integer,
  added_by        uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index pde_day_idx on planned_day_exercises (planned_day_id);

create table set_logs (
  id                      uuid primary key default gen_random_uuid(),
  planned_day_exercise_id uuid not null references planned_day_exercises(id) on delete cascade,
  user_id                 uuid not null references profiles(id) on delete cascade,
  set_no                  integer not null,
  weight                  numeric,
  reps                    integer,
  rpe                     numeric,
  notes                   text,
  logged_at               timestamptz not null default now(),
  volume numeric generated always as (coalesce(weight,0) * coalesce(reps,0)) stored,
  unique (planned_day_exercise_id, user_id, set_no)
);
create index set_logs_user_idx on set_logs (user_id);

create table bodyweight_logs (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date    date not null,
  weight  numeric not null,
  note    text,
  unique (user_id, date)
);
