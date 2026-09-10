import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/nav-bar";
import { AppTour } from "@/components/app-tour";
import { SubmitFeedback } from "@/components/submit-feedback";

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
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/80 px-4 py-3 backdrop-blur">
        <Link href="/" className="font-semibold">
          Gym<span className="text-text-muted">Planner</span>
        </Link>
        <div className="flex items-center gap-3">
          <SubmitFeedback defaultEmail={user.email ?? ""} />
          <Link
            href="/account"
            className="rounded-md px-2 py-1 text-xs text-text-muted hover:text-text"
          >
            {profile?.display_name || "Account"}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-5">{children}</main>

      <NavBar />
      <AppTour />
    </div>
  );
}
