import Link from "next/link";
import { CATEGORY_LABEL, CATEGORY_STYLE, dayType } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

export type ProgramSummary = {
  id: string;
  name: string;
  description: string | null;
  category: Enums<"muscle_category"> | null;
  program_exercises: {
    id: string;
    sort: number;
    exercises: { name: string } | null;
  }[];
};

/** A saved day, as a card: its name, session type, and a peek at the exercises. */
export function ProgramCard({ program }: { program: ProgramSummary }) {
  const names = [...program.program_exercises]
    .sort((a, b) => a.sort - b.sort)
    .flatMap((r) => (r.exercises ? [r.exercises.name] : []));
  const type = dayType(program.category);
  const preview = names.slice(0, 3).join(" · ");
  const more = names.length - 3;

  return (
    <Link
      href={`/programs/${program.id}`}
      className="flex flex-col gap-2 rounded-xl border border-border p-4 hover:bg-surface"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{program.name}</span>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-xs ${CATEGORY_STYLE[type]}`}
        >
          {CATEGORY_LABEL[type]}
        </span>
      </div>
      {program.description && (
        <p className="line-clamp-2 text-sm text-text-muted">
          {program.description}
        </p>
      )}
      <p className="text-xs text-text-muted">
        {names.length === 0 ? (
          "No exercises yet"
        ) : (
          <>
            <span className="text-text">{names.length}</span> exercise
            {names.length === 1 ? "" : "s"} · {preview}
            {more > 0 && ` · +${more} more`}
          </>
        )}
      </p>
    </Link>
  );
}
