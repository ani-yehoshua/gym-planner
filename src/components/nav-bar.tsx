"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  ChartIcon,
  DumbbellIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";

const NAV = [
  { href: "/", label: "Calendar", Icon: CalendarIcon, match: (p: string) => p === "/" || p.startsWith("/day") },
  { href: "/exercises", label: "Exercises", Icon: DumbbellIcon, match: (p: string) => p.startsWith("/exercises") },
  { href: "/parties", label: "Parties", Icon: UsersIcon, match: (p: string) => p.startsWith("/parties") },
  { href: "/progress", label: "Progress", Icon: ChartIcon, match: (p: string) => p.startsWith("/progress") },
  { href: "/account", label: "Account", Icon: UserIcon, match: (p: string) => p.startsWith("/account") || p.startsWith("/admin") },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-10 grid grid-cols-5 border-t border-border bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] font-medium ${
              active ? "text-text" : "text-text-muted hover:text-text"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
