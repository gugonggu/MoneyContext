import "server-only";

import { todayInSeoul } from "@/lib/dates/seoul";
import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { createCalendarRepository } from "./repository";
import { createCalendarService } from "./service";

export async function getCalendarMonthForCurrentUser(year: number, month: number) {
  const [profile, supabase] = await Promise.all([
    requireCurrentProfile(),
    createSupabaseServerClient(),
  ]);

  return createCalendarService(createCalendarRepository(supabase)).getMonth(
    profile.id,
    year,
    month,
    todayInSeoul(),
  );
}
