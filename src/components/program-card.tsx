import Link from "next/link";
import { durationLabel } from "@/lib/programs";

export type ProgramSummary = {
  id: string;
  name: string;
  description: string | null;
  duration_unit: string;
  duration_count: number;
  program_days: { id: string; position: number; name: string; is_rest: boolean }[];
};

/** A program as a card: its name, how long it runs, and the days it's made of. */
export function ProgramCard({ program }: { program: ProgramSummary }) {
  const days = [...program.program_days].sort((a, b) => a.position - b.position);
  const training = days.filter((d) => !d.is_rest);
  const rest = days.length - training.length;
  const preview = training.slice(0, 4).map((d) => d.name).join(" · ");
  const more = training.length - 4;

  return (
    <Link
      href={`/programs/${program.id}`}
      className="flex flex-col gap-2 rounded-xl border border-border p-4 hover:bg-surface"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{program.name}</span>
        <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-xs text-text-muted">
          {durationLabel(program.duration_unit, program.duration_count)}
        </span>
      </div>
      {program.description && (
        <p className="line-clamp-2 text-sm text-text-muted">
          {program.description}
        </p>
      )}
      <p className="text-xs text-text-muted">
        {training.length === 0 ? (
          "No days yet"
        ) : (
          <>
            <span className="text-text">{training.length}</span> training{" "}
            {training.length === 1 ? "day" : "days"}
            {rest > 0 && ` · ${rest} rest`} · {preview}
            {more > 0 && ` · +${more} more`}
          </>
        )}
      </p>
    </Link>
  );
}
