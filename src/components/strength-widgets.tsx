"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, formatShort } from "@/lib/date";
import { CATEGORY_DOT, CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/labels";
import { epley1rm, round5 } from "@/lib/one-rm";
import { unitLabel, type Unit } from "@/lib/units";
import type { Enums } from "@/lib/supabase/database.types";

export type StrengthRow = {
  exerciseId: string;
  name: string;
  category: Enums<"muscle_category">;
  weight: number;
  reps: number;
  date: string; // YYYY-MM-DD in the user's timezone
};

type View = "records" | "e1rm" | "trend" | "volume";
type Range = "7d" | "30d" | "90d" | "all";

const VIEWS: { id: View; label: string }[] = [
  { id: "records", label: "Records" },
  { id: "e1rm", label: "Est. 1RM" },
  { id: "trend", label: "Trend" },
  { id: "volume", label: "Volume" },
];
const RANGES: { id: Range; label: string; days: number | null }[] = [
  { id: "7d", label: "7d", days: 7 },
  { id: "30d", label: "30d", days: 30 },
  { id: "90d", label: "90d", days: 90 },
  { id: "all", label: "All", days: null },
];
const RANGE_WORD: Record<Range, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "all time",
};

const STORE_KEY = "gymplanner:strengthWidget";
const TOP_N = 8;
const NEW_PR_DAYS = 14;

const e1rm = (w: number, r: number) => round5(epley1rm(w, r));

type Session = { date: string; topWeight: number; topE1rm: number };
type ExAgg = {
  exerciseId: string;
  name: string;
  category: Enums<"muscle_category">;
  sessionCount: number;
  sessions: Session[]; // oldest -> newest
  best: { weight: number; reps: number; date: string; e1rm: number };
  volume: number;
};

export function StrengthWidgets({
  rows,
  todayISO,
  units,
}: {
  rows: StrengthRow[];
  todayISO: string;
  units: Unit;
}) {
  const u = unitLabel(units);
  const [prefs, setPrefs] = useState<{ view: View; range: Range }>({
    view: "records",
    range: "30d",
  });
  const [showAll, setShowAll] = useState(false);
  const { view, range } = prefs;

  useEffect(() => {
    const restore = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
        setPrefs((p) => ({
          view: VIEWS.some((v) => v.id === saved.view) ? saved.view : p.view,
          range: RANGES.some((r) => r.id === saved.range) ? saved.range : p.range,
        }));
      } catch {
        /* no-op */
      }
    };
    restore();
  }, []);

  const update = (next: Partial<{ view: View; range: Range }>) => {
    setPrefs((p) => {
      const merged = { ...p, ...next };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(merged));
      } catch {
        /* no-op */
      }
      return merged;
    });
  };
  const setView = (v: View) => update({ view: v });
  const setRange = (r: Range) => update({ range: r });

  const aggs = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    const cutoff = days ? addDays(todayISO, -(days - 1)) : null;
    const inRange = cutoff ? rows.filter((r) => r.date >= cutoff) : rows;

    const byEx = new Map<string, StrengthRow[]>();
    for (const r of inRange) {
      const arr = byEx.get(r.exerciseId);
      if (arr) arr.push(r);
      else byEx.set(r.exerciseId, [r]);
    }

    const out: ExAgg[] = [];
    for (const [exerciseId, list] of byEx) {
      const byDate = new Map<string, StrengthRow[]>();
      for (const r of list) {
        const arr = byDate.get(r.date);
        if (arr) arr.push(r);
        else byDate.set(r.date, [r]);
      }
      const sessions: Session[] = [...byDate.entries()]
        .map(([date, sets]) => {
          let topWeight = 0;
          let topE1rm = 0;
          for (const s of sets) {
            if (s.weight > topWeight) topWeight = s.weight;
            const e = e1rm(s.weight, s.reps);
            if (e > topE1rm) topE1rm = e;
          }
          return { date, topWeight, topE1rm };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      let best = { weight: 0, reps: 0, date: "", e1rm: -1 };
      let volume = 0;
      for (const s of list) {
        volume += s.weight * s.reps;
        const e = e1rm(s.weight, s.reps);
        if (e > best.e1rm)
          best = { weight: s.weight, reps: s.reps, date: s.date, e1rm: e };
      }

      out.push({
        exerciseId,
        name: list[0].name,
        category: list[0].category,
        sessionCount: sessions.length,
        sessions,
        best,
        volume: Math.round(volume),
      });
    }
    return out;
  }, [rows, range, todayISO]);

  const ranked = useMemo(
    () => [...aggs].sort((a, b) => b.best.e1rm - a.best.e1rm),
    [aggs],
  );
  const byFrequency = useMemo(
    () =>
      [...aggs].sort(
        (a, b) => b.sessionCount - a.sessionCount || b.volume - a.volume,
      ),
    [aggs],
  );

  const keepIds = useMemo(
    () => new Set(byFrequency.slice(0, TOP_N).map((a) => a.exerciseId)),
    [byFrequency],
  );
  const hiddenCount = aggs.length - keepIds.size;
  const visible = (list: ExAgg[]) =>
    showAll ? list : list.filter((a) => keepIds.has(a.exerciseId));

  // "you just PR'd": your best set in range came from your latest session, and
  // that session was recent (so it doesn't linger for months on the All view)
  const recentCutoff = addDays(todayISO, -(NEW_PR_DAYS - 1));
  const justPrd = (a: ExAgg) =>
    a.sessions.length >= 2 &&
    a.best.date === a.sessions[a.sessions.length - 1].date &&
    a.best.date >= recentCutoff;

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-text text-bg"
        : "text-text-muted hover:bg-surface-2 hover:text-text"
    }`;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Lifts</h2>
        <div className="flex gap-1 rounded-full border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={pill(range === r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex gap-1 overflow-x-auto rounded-full border border-border p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`${pill(view === v.id)} shrink-0`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {aggs.length === 0 ? (
        <p className="text-sm text-text-muted">
          {rows.length === 0
            ? "Log some weighted sets and this fills in."
            : `Nothing logged in the last ${RANGE_WORD[range]}.`}
        </p>
      ) : (
        <>
          {view === "records" && (
            <RecordsView aggs={visible(ranked)} prd={justPrd} unit={u} />
          )}
          {view === "e1rm" && (
            <E1rmView aggs={visible(ranked)} unit={u} />
          )}
          {view === "trend" && (
            <TrendView aggs={visible(ranked)} prd={justPrd} />
          )}
          {view === "volume" && (
            <VolumeView aggs={visible(byFrequency)} unit={u} />
          )}

          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:text-text"
            >
              {showAll ? "Show fewer" : `Show all (${hiddenCount} more)`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function setLabel(a: ExAgg) {
  return `${a.best.weight} × ${a.best.reps}`;
}

function NewPill() {
  return (
    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
      New
    </span>
  );
}

function RecordsView({
  aggs,
  prd,
  unit,
}: {
  aggs: ExAgg[];
  prd: (a: ExAgg) => boolean;
  unit: string;
}) {
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: aggs.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ cat, items }) => (
        <div key={cat}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[cat]}`} />
            {CATEGORY_LABEL[cat]}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {items.map((a) => (
              <div
                key={a.exerciseId}
                className="rounded-lg border border-border p-2.5"
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs font-medium leading-tight">
                    {a.name}
                  </span>
                  {prd(a) && <NewPill />}
                </div>
                <div className="mt-1.5 text-lg font-semibold tabular-nums">
                  {setLabel(a)}
                </div>
                <div className="text-[11px] text-text-muted">
                  e1RM {a.best.e1rm} {unit} · {formatShort(a.best.date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Delta({ sessions }: { sessions: Session[] }) {
  if (sessions.length < 2) return null;
  const d = sessions[sessions.length - 1].topE1rm - sessions[0].topE1rm;
  if (d === 0)
    return <span className="text-[11px] text-text-muted">no change</span>;
  const up = d > 0;
  return (
    <span
      className={`text-[11px] font-medium ${
        up ? "text-emerald-500" : "text-rose-500"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(d)}
    </span>
  );
}

function E1rmView({ aggs, unit }: { aggs: ExAgg[]; unit: string }) {
  return (
    <div className="flex flex-col gap-2">
      {aggs.map((a) => (
        <div
          key={a.exerciseId}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{a.name}</div>
            <div className="text-[11px] text-text-muted">
              best {setLabel(a)} · {formatShort(a.best.date)}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-xl font-semibold tabular-nums">
              {a.best.e1rm}
              <span className="ml-1 text-xs font-normal text-text-muted">
                {unit}
              </span>
            </span>
            <Delta sessions={a.sessions} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ sessions }: { sessions: Session[] }) {
  const w = 100;
  const h = 26;
  const pad = 3;
  const vals = sessions.map((s) => s.topWeight);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = vals.length;

  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);

  if (n === 1) {
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-6 w-full text-accent"
      >
        <line
          x1="0"
          x2={w}
          y1={h / 2}
          y2={h / 2}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2 3"
          opacity="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  const pts = vals.map((v, i) => {
    const x = pad + (i / (n - 1)) * (w - pad * 2);
    return [x, y(v)] as const;
  });
  const dPath = pts.map(([x, py], i) => `${i ? "L" : "M"}${x} ${py}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-6 w-full text-accent"
    >
      <path
        d={dPath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lx} cy={ly} r="1.6" fill="currentColor" />
    </svg>
  );
}

function TrendView({
  aggs,
  prd,
}: {
  aggs: ExAgg[];
  prd: (a: ExAgg) => boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {aggs.map((a) => (
        <div
          key={a.exerciseId}
          className="rounded-lg border border-border px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                CATEGORY_DOT[a.category]
              }`}
            />
            <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
            {prd(a) && <NewPill />}
            <span className="shrink-0 text-sm tabular-nums">{setLabel(a)}</span>
            <span className="shrink-0 text-[11px] text-text-muted">
              {formatShort(a.best.date)}
            </span>
          </div>
          <div className="mt-1.5">
            <Sparkline sessions={a.sessions} />
          </div>
        </div>
      ))}
    </div>
  );
}

function VolumeView({ aggs, unit }: { aggs: ExAgg[]; unit: string }) {
  const sorted = [...aggs].sort((a, b) => b.volume - a.volume);
  const max = Math.max(1, ...sorted.map((a) => a.volume));

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((a) => (
        <div
          key={a.exerciseId}
          className="rounded-lg border border-border px-3 py-2"
        >
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{a.name}</span>
            <span className="shrink-0 tabular-nums">
              {a.volume.toLocaleString()} {unit}
              <span className="ml-1 text-[11px] text-text-muted">
                · {a.sessionCount}{" "}
                {a.sessionCount === 1 ? "session" : "sessions"}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent/70"
              style={{ width: `${(a.volume / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
