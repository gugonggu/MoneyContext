import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/server/supabase/server";

export async function requireCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/invite");
  const { data: profile } = await supabase.from("profiles").select("id, role, onboarding_completed, salary_cycle_day").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/invite?error=profile");
  return profile;
}
