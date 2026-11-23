import { deleteMeasurements, logMeasurements } from "@/app/actions";
import { formatShort } from "@/lib/date";
import {
    fromCm,
    lengthUnit,
    SITES,
    type MeasurementRow,
    type SiteId,
} from "@/lib/measurements";
import type { Unit } from "@/lib/units";

const inp =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm";

/** Tape measurements: a form to log them, the latest value and change per
 *  site, and the full log. `rows` are in centimetres, newest first. */
export function MeasurementsPanel({
    rows,
    units,
    todayISO,
}: {
    rows: MeasurementRow[];
    units: Unit;
    todayISO: string;
}) {
    const u = lengthUnit(units);

    // per site: the latest reading and the one before it (not every day has
    // every site)
    const latest = SITES.map(s => {
        const readings = rows.flatMap(r =>
            r[s.id] != null ? [{ date: r.date, value: r[s.id]! }] : [],
        );
        const [now, before] = readings;
        return {
            ...s,
            now: now ? { ...now, value: fromCm(now.value, units) } : null,
            change:
                now && before
                    ? fromCm(now.value, units) - fromCm(before.value, units)
                    : null,
        };
    });

    return (
        <div className='flex flex-col gap-4'>
            <form
                action={logMeasurements}
                className='flex flex-col gap-3'>
                <label className='flex items-center gap-2 text-sm text-text-muted'>
                    Date
                    <input
                        type='date'
                        name='date'
                        defaultValue={todayISO}
                        className='rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text'
                    />
                </label>
                <div className='grid grid-cols-2 gap-2'>
                    {SITES.map(s => (
                        <label
                            key={s.id}
                            className='flex flex-col gap-1 text-xs text-text-muted'>
                            {s.label} ({u})
                            <input
                                type='number'
                                step='0.1'
                                min='0'
                                inputMode='decimal'
                                name={s.id}
                                className={inp}
                            />
                        </label>
                    ))}
                </div>
                <div className='flex items-center gap-3'>
                    <button className='rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg'>
                        Log
                    </button>
                    <span className='text-xs text-text-muted'>
                        Fill in any sites. Blank ones are left as they were.
                    </span>
                </div>
            </form>

            {rows.length > 0 && (
                <>
                    <div className='grid grid-cols-2 gap-2'>
                        {latest.map(s => (
                            <div
                                key={s.id}
                                className='rounded-lg border border-border p-2.5'>
                                <div className='text-xs text-text-muted'>
                                    {s.label}
                                </div>
                                {s.now ? (
                                    <>
                                        <div className='mt-0.5 text-lg font-semibold tabular-nums'>
                                            {s.now.value} {u}
                                        </div>
                                        <div className='text-[11px] text-text-muted'>
                                            {formatShort(s.now.date)}
                                        </div>
                                        {s.change != null && s.change !== 0 && (
                                            <div className='mt-0.5 text-[11px] font-medium tabular-nums text-text-muted'>
                                                {s.change > 0 ? "▲ +" : "▼ −"}
                                                {Math.abs(
                                                    Math.round(s.change * 10) /
                                                        10,
                                                )}{" "}
                                                {u}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className='mt-0.5 text-sm text-text-muted'>
                                        —
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className='max-h-96 overflow-y-auto overflow-x-hidden rounded-xl border border-border'>
                        <ul className='flex flex-col divide-y divide-border'>
                            {rows.map(r => (
                                <li
                                    key={r.date}
                                    className='flex items-start justify-between gap-3 px-3 py-2 text-xs'>
                                    <span className='min-w-0'>
                                        <span className='block font-medium text-text'>
                                            {r.date}
                                        </span>
                                        <span className='block text-text-muted'>
                                            {SITES.filter(
                                                s => r[s.id as SiteId] != null,
                                            )
                                                .map(
                                                    s =>
                                                        `${s.label} ${fromCm(r[s.id as SiteId]!, units)}`,
                                                )
                                                .join(" · ")}
                                        </span>
                                    </span>
                                    <form action={deleteMeasurements}>
                                        <input
                                            type='hidden'
                                            name='date'
                                            value={r.date}
                                        />
                                        <button
                                            aria-label={`Delete measurements for ${r.date}`}
                                            className='text-text-muted hover:text-rose-500'>
                                            ✕
                                        </button>
                                    </form>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}
