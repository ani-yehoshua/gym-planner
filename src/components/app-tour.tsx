"use client";

import { useEffect, useState } from "react";
import {
  CalendarIcon,
  ChartIcon,
  DumbbellIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";

const KEY = "gymplanner:tourDone";
const REPLAY_EVENT = "gymplanner:replay-tour";

const STEPS = [
  {
    Icon: CalendarIcon,
    title: "Calendar",
    body: "Your week at a glance. Pick a session type on any day and you drop straight in to add exercises and log every set.",
  },
  {
    Icon: DumbbellIcon,
    title: "Exercises",
    body: "The full library, grouped by muscle. Set your own default weight and reps for any lift, or request one that's missing.",
  },
  {
    Icon: UsersIcon,
    title: "Parties",
    body: "Train together. Spin up a party, share the join code, and shared days keep everyone's plan and progress in sync.",
  },
  {
    Icon: ChartIcon,
    title: "Progress",
    body: "Bodyweight, records, estimated 1RMs, and side-by-side session comparisons — switch views and time ranges as you like.",
  },
  {
    Icon: UserIcon,
    title: "Account",
    body: "Goals, units, timezone, schedule, theme. Tweak anything here whenever — and replay this tour from the bottom of the page.",
  },
];

export function AppTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    const start = () => {
      setI(0);
      setOpen(true);
    };
    try {
      if (localStorage.getItem(KEY) !== "1") start();
    } catch {
      /* no-op */
    }
    window.addEventListener(REPLAY_EVENT, start);
    return () => window.removeEventListener(REPLAY_EVENT, start);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function finish() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* no-op */
    }
    setOpen(false);
  }

  if (!open) return null;

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={finish}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-bg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="rounded-xl bg-surface-2 p-2.5 text-text">
            <step.Icon className="h-6 w-6" />
          </div>
          <button
            onClick={finish}
            className="text-xs text-text-muted hover:text-text"
          >
            Skip
          </button>
        </div>

        <h2 className="mt-3 text-base font-semibold">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          {step.body}
        </p>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 rounded-full transition-all ${
                  n === i ? "w-4 bg-text" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <button
                onClick={() => setI(i - 1)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setI(i + 1))}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg"
            >
              {last ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReplayTourButton() {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* no-op */
        }
        window.dispatchEvent(new Event(REPLAY_EVENT));
      }}
      className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text"
    >
      Replay app tour
    </button>
  );
}
