import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { openOrCreateDay } from "@/app/actions";
import {
  addDays,
  dayOfMonth,
  dowShort,
  formatRange,
  startOfWeek,
  today,
  weekDates,
} from "@/lib/date";
import { CATEGORY_LABEL, CATEGORY_STYLE, DAY_CATEGORY_CHOICES } from "@/lib/labels";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const weekStart = startOfWeek(week ?? today());
  const dates = weekDates(weekStart);
  const todayISO = today();

  const { data: days } = await supabase
    .from("planned_days")
    .select("id, date, category, label, owner_user, party_id, parties(name), planned_day_exercises(id)")
    .gte("date", dates[0])
    .lte("date", dates[6])
    .order("date");

  const byDate = new Map<string, NonNullable<typeof days>>();
  for (const d of days ?? []) {
    const arr = byDate.get(d.date) ?? [];
    arr.push(d);
    byDate.set(d.date, arr);
  }

  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{formatRange(dates[0], dates[6])}</h1>
        <div className="flex items-center gap-1 text-sm">
          <Link href={`/?week=${prevWeek}`} className="rounded-md px-2 py-1 hover:bg-surface">
            ←
          </Link>
          <Link href="/" className="rounded-md px-2 py-1 text-text-muted hover:bg-surface">
            Today
          </Link>
          <Link href={`/?week=${nextWeek}`} className="rounded-md px-2 py-1 hover:bg-surface">
            →
          </Link>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {dates.map((date) => {
          const dayList = byDate.get(date) ?? [];
          const isToday = date === todayISO;
          return (
            <li
              key={date}
              className={`rounded-xl border p-3 ${
                isToday ? "border-text-muted bg-surface/60" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 shrink-0 text-center">
                  <div className="text-[11px] uppercase text-text-muted">{dowShort(date)}</div>
                  <div className="text-lg font-semibold leading-none">{dayOfMonth(date)}</div>
                </div>

                <div className="flex-1">
                  {dayList.length === 0 ? (
                    <form action={openOrCreateDay} className="flex items-center gap-2">
                      <input type="hidden" name="date" value={date} />
                      <select
                        name="category"
                        defaultValue=""
                        className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                      >
                        <option value="">Plan a day…</option>
                        {DAY_CATEGORY_CHOICES.filter((c) => c !== "rest").map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABEL[c]}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg">
                        Add
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {dayList.map((d) => (
                        <Link
                          key={d.id}
                          href={`/day/${d.id}`}
                          className="flex items-center justify-between rounded-lg bg-surface-2/60 px-3 py-2 hover:bg-surface-2"
                        >
                          <span className="flex items-center gap-2">
                            {d.category && (
                              <span
                                className={`rounded-md border px-2 py-0.5 text-xs ${CATEGORY_STYLE[d.category]}`}
                              >
                                {CATEGORY_LABEL[d.category]}
                              </span>
                            )}
                            {d.party_id && (
                              <span className="text-xs text-text-muted">
                                · {d.parties?.name ?? "Party"}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-text-muted">
                            {d.planned_day_exercises.length} exercises
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
