"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { createPartyDay } from "@/app/actions";
import { CATEGORY_LABEL, DAY_PLAN_CHOICES } from "@/lib/labels";
import { parseProgramChoice, programChoiceValue } from "@/lib/programs";

/** The Calendar's "Plan session…" for a party: pick the date, then a session
 *  type to build your own shared day, or a program to load onto the party's
 *  calendar from that date (everyone in the party gets its days). */
export function PartyPlanForm({
    partyId,
    defaultDate,
    programs,
}: {
    partyId: string;
    defaultDate: string;
    programs: { id: string; name: string }[];
}) {
    const formRef = useRef<HTMLFormElement>(null);
    const router = useRouter();

    return (
        <form
            ref={formRef}
            action={createPartyDay}
            className='rounded-xl border border-border p-4'>
            <span className='text-sm font-medium'>Plan a shared day</span>
            <input
                type='hidden'
                name='party_id'
                value={partyId}
            />
            <div className='mt-2 flex flex-wrap gap-2'>
                <input
                    type='date'
                    name='date'
                    required
                    defaultValue={defaultDate}
                    aria-label='Date'
                    className='rounded-lg border border-border bg-surface px-3 py-2 text-sm'
                />
                <select
                    name='category'
                    defaultValue=''
                    onChange={e => {
                        const select = e.currentTarget;
                        const form = formRef.current;
                        if (!select.value || !form) return;
                        // both paths need a date
                        if (!form.reportValidity()) {
                            select.value = "";
                            return;
                        }
                        const programId = parseProgramChoice(select.value);
                        if (programId) {
                            const date = new FormData(form).get("date");
                            router.push(
                                `/programs/${programId}?start=${date}&party=${partyId}`,
                            );
                            return;
                        }
                        form.requestSubmit();
                    }}
                    className='min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-muted'>
                    <option
                        value=''
                        disabled>
                        Plan session…
                    </option>
                    <optgroup label='Build your own'>
                        {DAY_PLAN_CHOICES.map(c => (
                            <option
                                key={c}
                                value={c}>
                                {CATEGORY_LABEL[c]}
                            </option>
                        ))}
                    </optgroup>
                    {programs.length > 0 && (
                        <optgroup label='Start a program'>
                            {programs.map(p => (
                                <option
                                    key={p.id}
                                    value={programChoiceValue(p.id)}>
                                    {p.name}
                                </option>
                            ))}
                        </optgroup>
                    )}
                </select>
            </div>
        </form>
    );
}
