"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-fetches the current route whenever one of the given tables changes. */
export function RealtimeRefresh({
    channel,
    tables,
}: {
    channel: string;
    tables: { table: string; filter?: string }[];
}) {
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();
        let ch = supabase.channel(channel);
        for (const t of tables) {
            ch = ch.on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: t.table,
                    ...(t.filter ? { filter: t.filter } : {}),
                },
                () => router.refresh(),
            );
            // A filtered subscription never sees DELETEs (Postgres only sends
            // the deleted row's primary key, so there's nothing to filter on).
            // Listen for deletes on the table as a whole; a refresh is cheap.
            if (t.filter) {
                ch = ch.on(
                    "postgres_changes",
                    { event: "DELETE", schema: "public", table: t.table },
                    () => router.refresh(),
                );
            }
        }
        ch.subscribe();
        return () => {
            supabase.removeChannel(ch);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channel, JSON.stringify(tables)]);

    return null;
}
