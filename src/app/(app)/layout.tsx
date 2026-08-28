import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/", label: "Calendar" },
  { href: "/exercises", label: "Exercises" },
  { href: "/parties", label: "Parties" },
  { href: "/progress", label: "Progress" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded_at")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur">
        <Link href="/" className="font-semibold">
          GymPlanner
        </Link>
        <form action="/auth/signout" method="post">
          <button className="text-xs text-zinc-400 hover:text-zinc-200">
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 px-4 py-5">{children}</main>

      <nav className="sticky bottom-0 grid grid-cols-4 border-t border-zinc-800 bg-zinc-950">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="py-3 text-center text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
