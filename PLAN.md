# GymPlannerApp — Plan

## Vision
A gym **planner** where people don't have to research what to train and when. Users get
near-total control over their regimen; the app provides sensible defaults (schedule
templates, exercise catalog, guidance) and a shared planning surface for training together.

## Stack
- Next.js (TS, App Router, Tailwind, `src/`) — web now, React Native later
- Supabase: Auth (Google + email magic link), Postgres, Row-Level Security, Storage (how-to media)
- Hosted on Vercel (`gym-planner`)

## Core primitive: the calendar
One unified calendar per user. Every training day is a `planned_day` (a date + a muscle-group
category + an ordered exercise list + per-user set logs). Solo days and party days live on the
same calendar. Schedule templates and duration plans just generate `planned_day`s in bulk.

## Model (Phase 1)
- `profiles` — display name, avatar, unit preference (lb/kg), timezone
- `user_constants` — questionnaire output: experience level, primary goal, target bodyweight,
  weekly-gain rate, optional weekly set targets per muscle group. Editable anytime, skippable.
- `exercises` — catalog. name, category (push/pull/legs/upper/lower/core/cardio), primary +
  secondary muscle groups, default set scheme, howto_text, media_url, `created_by` (null = global seed)
- `schedule_templates` / `template_days` / `template_day_exercises` — Blank, 5-Day PPLUL (from
  the sheet), 3-Day Full Body, 6-Day PPL. Applying one over a chosen duration generates planned days.
- `planned_days` — date, category, label, `owner_type` (user | party), `owner_id`, `created_by`
- `planned_day_exercises` — planned_day_id, exercise_id, order, target_scheme, added_by
  (single shared list on party days; any member edits)
- `set_logs` — planned_day_exercise_id, user_id, set_no, weight, reps, notes, logged_at.
  Generated column `volume = weight * reps`. View for top set per (user, exercise, day).
- `bodyweight_logs` — user_id, date, weight, note (weekly-average workflow supported)
- `parties` — name, `invite_type` (open | invite_only), created_by
- `party_members` — party_id, user_id, role (owner | member), joined_at
- `party_invites` — party_id, code, created_by, expires_at, max_uses

### RLS sketch
- Users read/write only their own `user_constants`, `set_logs`, `bodyweight_logs`, solo `planned_days`.
- Party members read the party's `planned_days` + `planned_day_exercises`, and each other's
  `set_logs` on party days (the "see everyone's gains" view). Any member edits the shared exercise list.
- `exercises`: global seeds readable by all; custom rows readable/editable by creator (later: shareable).

## V1 scope
1. Auth + onboarding questionnaire → `user_constants`
2. Exercise catalog (~60 seeded, PPLUL + muscle groups) + add-custom-exercise
3. Calendar (mobile-first week view) — the home surface
4. Plan a day: assign category, add exercises (filtered by category), set target scheme
5. Log sets: weight + reps per set, notes; auto volume + top set
6. Bodyweight log + chart
7. Progress: per-exercise top-set/volume charts, key-lift progress, weekly volume vs target
8. Parties: create (open/invite-only), join by link/code, shared calendar days with one shared
   exercise list, per-person set logging, view party members' logs + simple progress
9. Schedule templates incl. 5-Day PPLUL; apply over a chosen duration (4 / 8 / 12 weeks / ongoing)

## Deferred (v1.5 / v2)
- Progression auto-suggestion engine (from the sheet's Read-Me rules)
- How-to videos / GIFs (v1 = text how-to only)
- Calorie / protein tracking
- Leaderboards, richer social feed
- React Native app
