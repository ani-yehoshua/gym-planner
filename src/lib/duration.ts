/** Parses a duration typed as plain seconds ("90"), "M:SS" ("1:30"), or
 *  "1m30s"/"1m"/"30s" into total seconds. Returns null if empty/unparseable. */
export function parseDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  const colon = s.match(/^(\d+):([0-5]?\d)$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);

  const minSec = s.match(/^(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i);
  if (minSec && (minSec[1] || minSec[2])) {
    return Number(minSec[1] ?? 0) * 60 + Number(minSec[2] ?? 0);
  }

  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Formats total seconds as "M:SS" once a minute or more, otherwise plain
 *  seconds — so the field only ever shows what someone would naturally type. */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return String(totalSeconds);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
