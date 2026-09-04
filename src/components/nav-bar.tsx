"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  ChartIcon,
  DumbbellIcon,
  ResumeIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import { getActiveSession } from "@/lib/active-session";
import { CATEGORY_DOT } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

const NAV = [
  { href: "/exercises", label: "Exercises", Icon: DumbbellIcon, match: (p: string) => p.startsWith("/exercises") },
  { href: "/parties", label: "Parties", Icon: UsersIcon, match: (p: string) => p.startsWith("/parties") },
  { href: "/progress", label: "Progress", Icon: ChartIcon, match: (p: string) => p.startsWith("/progress") },
  { href: "/account", label: "Account", Icon: UserIcon, match: (p: string) => p.startsWith("/account") || p.startsWith("/admin") },
];

export function NavBar() {
  const pathname = usePathname();
  const [resume, setResume] = useState<{ dayId: string; category: string | null } | null>(null);

  useEffect(() => {
    const check = () => {
      const s = getActiveSession();
      const suppressed =
        !s || pathname === "/" || pathname.startsWith(`/day/${s.dayId}`);
      setResume(suppressed ? null : { dayId: s.dayId, category: s.category });
    };
    check();
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("focus", check);
    };
  }, [pathname]);

  const dotClass = resume?.category
    ? CATEGORY_DOT[resume.category as Enums<"muscle_category">]
    : "bg-accent";

  const onCalendarTab = pathname === "/" || pathname.startsWith("/day");
  const calendarTab = resume
    ? {
        href: `/day/${resume.dayId}`,
        label: "Resume",
        Icon: ResumeIcon,
        active: false,
        badge: true,
      }
    : {
        href: "/",
        label: "Calendar",
        Icon: CalendarIcon,
        active: onCalendarTab,
        badge: false,
      };

  const tabs = [
    calendarTab,
    ...NAV.map((n) => ({ ...n, active: n.match(pathname), badge: false })),
  ];

  return (
    <nav
      className="sticky bottom-0 z-10 grid grid-cols-5 border-t border-border bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ href, label, Icon, active, badge }) => (
        <Link
          key={label}
          href={href}
          className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] font-medium ${
            active ? "text-text" : "text-text-muted hover:text-text"
          } ${badge ? "text-accent" : ""}`}
        >
          <span className="relative">
            <Icon className="h-5 w-5" />
            {badge && (
              <span
                className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${dotClass}`}
              />
            )}
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
