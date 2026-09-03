import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/date";

/** The signed-in user's current calendar date (YYYY-MM-DD), resolved in their
 *  saved profile timezone. Cached per request. */
export const getUserToday = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let tz = "America/Chicago";
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.timezone) tz = data.timezone;
  }
  return todayInTz(tz);
});
