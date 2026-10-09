/** Parses a typed duration into total seconds; null if empty or unparseable.
 *  Minute notation is the default: a bare number is MINUTES ("2" = 2:00,
 *  "1.5" = 1:30). Also "M:SS" ("1:30"), "H:MM:SS" ("1:05:00"), and units
 *  ("45s", "2m", "1m30s", "1h", "1h 5m") for anything else. */
export function parseDuration(raw: string): number | null {
    const s = raw.trim().toLowerCase();
    if (!s) return null;

    const hms = s.match(/^(\d+):([0-5]?\d):([0-5]?\d)$/);
    if (hms)
        return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);

    const colon = s.match(/^(\d+):([0-5]?\d)$/);
    if (colon) return Number(colon[1]) * 60 + Number(colon[2]);

    const units = s.match(
        /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?)?$/,
    );
    if (units && (units[1] || units[2] || units[3])) {
        return Math.round(
            Number(units[1] ?? 0) * 3600 +
                Number(units[2] ?? 0) * 60 +
                Number(units[3] ?? 0),
        );
    }

    const minutes = Number(s);
    return Number.isFinite(minutes) && minutes >= 0
        ? Math.round(minutes * 60)
        : null;
}

/** Formats total seconds in minute notation: "0:45", "2:00", "12:30", and
 *  "1:05:00" once there's an hour. */
export function formatDuration(totalSeconds: number): string {
    const t = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = t % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Formats milliseconds as a stopwatch readout: MM:SS:CS, growing to
 *  HH:MM:SS:CS once an hour has elapsed — the hour slot stays hidden until
 *  it's actually needed. */
export function formatStopwatch(ms: number): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const totalCs = Math.floor(Math.max(0, ms) / 10);
    const cs = totalCs % 100;
    const totalSeconds = Math.floor(totalCs / 100);
    const s = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const m = totalMinutes % 60;
    const h = Math.floor(totalMinutes / 60);
    return h > 0
        ? `${pad(h)}:${pad(m)}:${pad(s)}:${pad(cs)}`
        : `${pad(m)}:${pad(s)}:${pad(cs)}`;
}
