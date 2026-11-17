import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

export type ProposalItem = {
    id: string;
    exerciseName: string;
    oldSets: number | null;
    newSets: number | null;
    oldRepMin: number | null;
    oldRepMax: number | null;
    newRepMin: number | null;
    newRepMax: number | null;
};

/** The pending changes one member proposed for one session, for you to answer. */
export type ProposalGroup = {
    key: string;
    proposer: string;
    dayId: string;
    dayDate: string;
    dayLabel: string | null;
    items: ProposalItem[];
};

/** Changes other members have proposed to your sessions that you haven't
 *  answered, grouped by who proposed them and which session they're for. Pass a
 *  day or a party to narrow it. */
export async function fetchPendingProposals(
    supabase: Client,
    userId: string,
    where: { dayId?: string; partyId?: string } = {},
): Promise<ProposalGroup[]> {
    let query = supabase
        .from('party_change_proposals')
        .select(
            'id, planned_day_id, old_sets, new_sets, old_rep_min, old_rep_max, new_rep_min, new_rep_max, created_at, planned_day_exercises(exercises(name)), planned_days!inner(id, date, label, party_id), profiles!party_change_proposals_proposer_fkey(display_name)',
        )
        .eq('recipient', userId)
        .eq('status', 'pending')
        .order('created_at');
    if (where.dayId) query = query.eq('planned_day_id', where.dayId);
    if (where.partyId) query = query.eq('planned_days.party_id', where.partyId);
    const { data } = await query;

    const groups = new Map<string, ProposalGroup>();
    for (const r of data ?? []) {
        const day = r.planned_days;
        if (!day) continue;
        const proposer = r.profiles?.display_name || 'A member';
        const key = `${r.planned_day_id}:${proposer}`;
        const group = groups.get(key) ?? {
            key,
            proposer,
            dayId: day.id,
            dayDate: day.date,
            dayLabel: day.label,
            items: [],
        };
        group.items.push({
            id: r.id,
            exerciseName:
                r.planned_day_exercises?.exercises?.name ?? 'Exercise',
            oldSets: r.old_sets,
            newSets: r.new_sets,
            oldRepMin: r.old_rep_min,
            oldRepMax: r.old_rep_max,
            newRepMin: r.new_rep_min,
            newRepMax: r.new_rep_max,
        });
        groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) =>
        a.dayDate.localeCompare(b.dayDate),
    );
}
