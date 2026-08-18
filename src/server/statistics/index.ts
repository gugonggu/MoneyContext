import "server-only";
import { requireCurrentProfile } from "@/server/auth/require-profile";
import { getAssetOverviewForCurrentUser } from "@/server/assets";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { buildHorizonDeductions } from "@/server/export/repository";
import { getSalaryCycle } from "@/lib/dates/salary-cycle";
import { addIsoDays, todayInSeoul } from "@/lib/dates/seoul";
import { calculateDailySpendable, calculateRemainingDaysUntilPayday, calculateSafeToSpend, splitDeductionsByHorizon } from "@/domain/forecasts/spendable";
import { listStatisticsTransactions } from "./repository";
import { buildStatistics } from "./service";
import type { StatisticsOverview, StatisticsSafeToSpend } from "./service";

export async function getStatisticsForCurrentUser(): Promise<StatisticsOverview> {
  const [profile, supabase, assets] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient(), getAssetOverviewForCurrentUser()]);
  const statistics = buildStatistics(await listStatisticsTransactions(supabase, profile.id), assets.netWorth);

  if (profile.salary_cycle_day === null || profile.emergency_fund_amount === null) return statistics;

  const today = todayInSeoul();
  const cycle = getSalaryCycle(today, profile.salary_cycle_day);
  const nextPaydayDate = addIsoDays(cycle.end, 1);
  const deductions = buildHorizonDeductions(assets, today);
  const { nearTerm } = splitDeductionsByHorizon(deductions, nextPaydayDate);
  const nearTermTotal = nearTerm.reduce((sum, item) => sum + item.amount, 0);
  const emergencyFundAmount = Number(profile.emergency_fund_amount);
  const amount = calculateSafeToSpend(assets.liquidAssets, nearTermTotal, emergencyFundAmount);
  const remainingDays = calculateRemainingDaysUntilPayday(today, nextPaydayDate);
  const dailyAmount = calculateDailySpendable(amount, remainingDays);
  const safeToSpend: StatisticsSafeToSpend = { amount, dailyAmount, weeklyAmount: dailyAmount * 7, nextPaydayDate };

  return { ...statistics, safeToSpend };
}
