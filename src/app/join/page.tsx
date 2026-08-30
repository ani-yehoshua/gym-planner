import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const clean = (code ?? "").trim().toUpperCase();
  if (!clean) redirect("/parties");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join?code=${clean}`)}`);
  }

  const { data, error } = await supabase.rpc("join_party_with_code", { p_code: clean });
  if (error || !data) redirect("/parties?error=join");
  redirect(`/parties/${data}`);
}
