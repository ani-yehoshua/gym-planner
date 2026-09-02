# GymPlanner

**GymPlanner** is a training planner and workout log. Plan your week on a
calendar, pick exercises for each day, log every set, and track your lifts and
bodyweight over time — solo, or in a shared party with training partners.

🔗 **[gym-planner-xi.vercel.app](https://gym-planner-xi.vercel.app)**

## Features

- **Calendar** — a week-at-a-time planner. Assign a muscle group to any day
  (Push, Pull, Legs, Upper, Lower, Chest, Back, Shoulders, Arms, Core, Cardio),
  then build its exercise list from the catalog.
- **Split presets** — PPL, PPL/UL, Upper/Lower, Bro Split, Full Body and more,
  applied over a chosen number of weeks. Reorder or swap any day before applying.
- **Set logging** — weight and reps per set, with auto top-set and volume, plus a
  per-exercise notes field for how it felt.
- **Goal-based targets** — recommended rep ranges and set counts from your goal
  and training experience; save your own default sets, rep range, and current
  working weight per exercise so days populate with the right numbers.
- **Parties** — create a training group, invite by code / link / QR, and plan
  shared days together. Everyone logs their own sets; per-member progress and
  who-added-what are visible on the day.
- **Plate calculator** — tap plates to add up a target weight without the math.
- **Progress & history** — bodyweight chart, best sets, and a week-by-week
  history of completed days.
- **Admin catalog** — manage the global exercise catalog (add, edit, archive,
  delete); other users submit "request an exercise" instead.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- React · TypeScript · Tailwind CSS
- Supabase (auth, Postgres, Row-Level Security, realtime)
- Resend (transactional email)
- Deployed on Vercel
