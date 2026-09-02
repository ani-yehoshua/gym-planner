"use client";

import { muscleLabel } from "@/lib/labels";

export type ExerciseInfo = {
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  howto_text: string | null;
  media_url: string | null;
};

function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function ExerciseDetailBody({ ex }: { ex: ExerciseInfo }) {
  const embed = ex.media_url ? embedUrl(ex.media_url) : null;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {ex.primary_muscles.map((m) => (
          <span
            key={m}
            className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs"
          >
            {muscleLabel(m)}
          </span>
        ))}
        {ex.secondary_muscles.map((m) => (
          <span key={m} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
            {muscleLabel(m)}
          </span>
        ))}
      </div>

      {ex.howto_text ? (
        <p className="whitespace-pre-line leading-relaxed text-text-muted">{ex.howto_text}</p>
      ) : (
        <p className="text-xs text-text-muted">No how-to added yet.</p>
      )}

      {embed && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
          <iframe
            src={embed}
            title={`${ex.name} demonstration`}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}
      {ex.media_url && !embed && (
        <a
          href={ex.media_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline"
        >
          Watch demonstration
        </a>
      )}
    </div>
  );
}
