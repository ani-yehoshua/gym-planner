"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Calendar", match: (p: string) => p === "/" || p.startsWith("/day") },
  { href: "/exercises", label: "Exercises", match: (p: string) => p.startsWith("/exercises") },
  { href: "/parties", label: "Parties", match: (p: string) => p.startsWith("/parties") },
  { href: "/progress", label: "Progress", match: (p: string) => p.startsWith("/progress") },
  { href: "/account", label: "Account", match: (p: string) => p.startsWith("/account") },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-10 grid grid-cols-5 border-t border-border bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map((n) => {
        const active = n.match(pathname);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex min-h-[3.25rem] items-center justify-center px-1 text-center text-xs font-medium ${
              active ? "text-text" : "text-text-muted hover:text-text"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
