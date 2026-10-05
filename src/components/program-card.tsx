import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/labels";
import { PROGRAM_GROUPS } from "@/lib/programs";
import type { Enums } from "@/lib/supabase/database.types";

export type ProgramSummary = {
  id: string;
  name: string;
  description: string | null;
  weeks: number;
  program_targets: { category: Enums<"muscle_category">; sets: number }[];
};

/** "chest 6 · back 8" for the groups a program sets targets on, in group order. */
export function targetChips(p: ProgramSummary) {
  const by = new Map(p.program_targets.map((t) => [t.category, t.sets]));
  return PROGRAM_GROUPS.filter((g) => (by.get(g) ?? 0) > 0).map((g) => ({
    category: g,
    sets: by.get(g)!,
  }));
}

export function ProgramCard({
  program,
  badge,
}: {
  program: ProgramSummary;
  badge?: string;
}) {
  const chips = targetChips(program);
  return (
    <Link
      href={`/programs/${program.id}`}
      className="flex flex-col gap-2 rounded-xl border border-border p-4 hover:bg-surface"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{program.name}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
          {badge && (
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-300">
              {badge}
            </span>
          )}
          {program.weeks} wk
        </span>
      </div>
      {program.description && (
        <p className="line-clamp-2 text-sm text-text-muted">
          {program.description}
        </p>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {chips.map((c) => (
            <span
              key={c.category}
              className="rounded-md border border-border px-1.5 py-0.5 text-text-muted"
            >
              {CATEGORY_LABEL[c.category]}{" "}
              <span className="text-text">{c.sets}</span>
            </span>
          ))}
          <span className="px-1 py-0.5 text-text-muted">sets / week</span>
        </div>
      )}
    </Link>
  );
}
