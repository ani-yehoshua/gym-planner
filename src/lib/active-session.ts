// Client-only "return to session" tracking. Remembers the last exercise you
// had in view on TODAY's day, so leaving the Calendar tab mid-session and
// coming back can drop you right where you left off. Scoped to today only —
// a day that's already over or hasn't started isn't a "session" to resume.

export type ActiveSession = {
  dayId: string;
  date: string; // the day's own date (YYYY-MM-DD), not necessarily "today"
  category: string | null;
  exerciseId: string | null;
  updatedAt: number;
};

const KEY = "gymplanner:activeSession";
const STALE_MS = 6 * 60 * 60 * 1000; // treat as "no longer training" after 6h idle

// Local calendar date as YYYY-MM-DD, in the browser's own timezone — this
// feature only ever runs client-side, on the device the user is training with.
function localDateISO(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

export function getActiveSession(): ActiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ActiveSession;
    const stale = !s.dayId || Date.now() - s.updatedAt > STALE_MS;
    const dayOver = s.date !== localDateISO();
    if (stale || dayOver) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setActiveSession(
  dayId: string,
  date: string,
  category: string | null,
  exerciseId: string | null,
) {
  if (typeof window === "undefined") return;
  if (date !== localDateISO()) return; // only track today's day
  try {
    const s: ActiveSession = {
      dayId,
      date,
      category,
      exerciseId,
      updatedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
}

export function clearActiveSession(dayId: string) {
  if (typeof window === "undefined") return;
  try {
    const s = getActiveSession();
    if (s?.dayId === dayId) localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
