// Client-only "return to session" tracking. Remembers the last day you had
// open, and the last exercise you had in view, so leaving the Calendar tab
// mid-session and coming back can drop you right where you left off.

export type ActiveSession = {
  dayId: string;
  exerciseId: string | null;
  updatedAt: number;
};

const KEY = "gymplanner:activeSession";
const STALE_MS = 6 * 60 * 60 * 1000; // treat as "no longer training" after 6h idle

export function getActiveSession(): ActiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ActiveSession;
    if (!s.dayId || Date.now() - s.updatedAt > STALE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setActiveSession(dayId: string, exerciseId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const s: ActiveSession = { dayId, exerciseId, updatedAt: Date.now() };
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
