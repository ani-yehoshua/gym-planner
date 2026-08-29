// All calendar dates are handled as plain YYYY-MM-DD strings in the user's local sense.

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// Sunday-start week containing `s`
export function startOfWeek(s: string): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = Sunday
  return toISODate(d);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function today(): string {
  return toISODate(new Date());
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function dowShort(s: string): string {
  return DOW[parseISODate(s).getDay()];
}

export function dayOfMonth(s: string): number {
  return parseISODate(s).getDate();
}

export function formatLong(s: string): string {
  const d = parseISODate(s);
  return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

export function formatRange(startS: string, endS: string): string {
  const a = parseISODate(startS);
  const b = parseISODate(endS);
  const left = `${MON[a.getMonth()]} ${a.getDate()}`;
  const right =
    a.getMonth() === b.getMonth()
      ? `${b.getDate()}`
      : `${MON[b.getMonth()]} ${b.getDate()}`;
  return `${left} – ${right}`;
}
