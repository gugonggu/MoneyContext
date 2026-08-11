import "server-only";
import { requireCurrentProfile } from "@/server/auth/require-profile";
import { getAssetOverviewForCurrentUser } from "@/server/assets";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { listStatisticsTransactions } from "./repository";
import { buildStatistics } from "./service";
export async function getStatisticsForCurrentUser() { const [profile, supabase, assets] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient(), getAssetOverviewForCurrentUser()]); return buildStatistics(await listStatisticsTransactions(supabase, profile.id), assets.netWorth); }
