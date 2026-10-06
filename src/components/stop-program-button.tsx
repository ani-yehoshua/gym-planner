"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { stopProgram } from "@/app/actions";

/** Leave the program you're following. Its days with nothing logged come off the
 *  calendar (anything you've logged stays), so it asks first. `redirectTo` is for use on
 *  a program day itself, which may be one of the days that just went away. */
export function StopProgramButton({
  label = "Stop program",
  redirectTo,
  className,
}: {
  label?: string;
  redirectTo?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Stop this program? Its days with nothing logged will be removed from your calendar. Anything you've already logged stays.",
          )
        )
          return;
        start(async () => {
          await stopProgram();
          if (redirectTo) router.push(redirectTo);
        });
      }}
      className={
        className ??
        "rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-300"
      }
    >
      {pending ? "Stopping…" : label}
    </button>
  );
}
