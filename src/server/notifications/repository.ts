import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationCandidate, NotificationType } from "@/domain/notifications/rules";
import type { NotificationRecord, NotificationRepository } from "@/server/notifications/service";

type NotificationRow = Readonly<{
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}>;

function toSafeInteger(value: number | string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${field} must be a safe integer`);
  return parsed;
}

function throwDatabaseError(error: Readonly<{ message: string; code?: string }>): never {
  throw Object.assign(new Error(error.message), { code: error.code });
}

function assertIsoDate(value: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("today must be a valid ISO date");
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("today must be a valid ISO date");
  }
  return [year, month, day];
}

function seoulDayStart(value: string): Date {
  const [year, month, day] = assertIsoDate(value);
  return new Date(Date.UTC(year, month - 1, day, -9));
}

function addDays(value: string, days: number): string {
  const [year, month, day] = assertIsoDate(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function seoulDate(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function cardDueDates(today: string, paymentDay: number): string[] {
  if (!Number.isSafeInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    throw new Error("credit card paymentDay must be between 1 and 31");
  }
  const lastDate = addDays(today, 3);
  const dates: string[] = [];
  const [startYear, startMonth] = assertIsoDate(today);
  const [endYear, endMonth] = assertIsoDate(lastDate);
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth); month += 1) {
    if (month === 13) {
      year += 1;
      month = 1;
    }
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (paymentDay > lastDay) continue;
    const dueDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(paymentDay).padStart(2, "0")}`;
    if (dueDate >= today && dueDate <= lastDate) dates.push(dueDate);
  }
  return dates;
}

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    isRead: row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

function notificationPayload(candidate: NotificationCandidate, today: string) {
  return {
    type: candidate.type,
    title: candidate.title,
    message: candidate.message,
    related_entity_type: candidate.relatedEntityType,
    related_entity_id: candidate.relatedEntityId,
    dedupe_key: candidate.dedupeKey,
    dedupe_day: today,
  };
}

export function createNotificationRepository(supabase: SupabaseClient): NotificationRepository {
  return {
    async getRuleInput(userId, today) {
      const [year, month] = assertIsoDate(today);
      const monthStart = `${today.slice(0, 7)}-01`;
      const nextMonthStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
      const [recurring, planned, cardSettings, budgets, transactions, goals, contributions] = await Promise.all([
        supabase.from("transactions").select("id,recurring_occurrence_date").eq("user_id", userId).eq("status", "PENDING").not("recurring_rule_id", "is", null),
        supabase.from("planned_transactions").select("id,scheduled_date,base_amount,status").eq("user_id", userId),
        supabase.from("credit_card_settings").select("account_id,payment_day").eq("user_id", userId),
        supabase.from("monthly_budgets").select("id,total_budget").eq("user_id", userId).eq("year", year).eq("month", month),
        supabase.from("transactions").select("type,status,transaction_at,base_amount").eq("user_id", userId).gte("transaction_at", seoulDayStart(monthStart).toISOString()).lt("transaction_at", seoulDayStart(nextMonthStart).toISOString()),
        supabase.from("savings_goals").select("id,target_amount,target_date,monthly_contribution_plan,is_active").eq("user_id", userId),
        supabase.from("savings_contributions").select("goal_id,amount").eq("user_id", userId),
      ]);
      for (const result of [recurring, planned, cardSettings, budgets, transactions, goals, contributions]) {
        if (result.error) throwDatabaseError(result.error);
      }

      const contributedByGoal = new Map<string, bigint>();
      for (const contribution of contributions.data ?? []) {
        const goalId = String(contribution.goal_id);
        const amount = BigInt(toSafeInteger(contribution.amount, "savings contribution amount"));
        contributedByGoal.set(goalId, (contributedByGoal.get(goalId) ?? 0n) + amount);
      }

      return {
        today,
        pendingRecurringTransactions: (recurring.data ?? []).map((row) => ({
          id: String(row.id),
          occurrenceDate: String(row.recurring_occurrence_date),
        })),
        plannedTransactions: (planned.data ?? []).flatMap((row) => row.base_amount === null ? [] : [{
          id: String(row.id),
          scheduledDate: String(row.scheduled_date),
          baseAmount: toSafeInteger(row.base_amount, "planned transaction base_amount"),
          status: row.status as "PLANNED" | "CONFIRMED" | "CANCELLED",
        }]),
        cardPayments: (cardSettings.data ?? []).flatMap((row) =>
          cardDueDates(today, toSafeInteger(row.payment_day, "credit card payment_day")).map((dueDate) => ({ accountId: String(row.account_id), dueDate })),
        ),
        monthlyBudgets: (budgets.data ?? []).map((row) => ({
          id: String(row.id),
          baseAmount: toSafeInteger(row.total_budget, "monthly budget total_budget"),
        })),
        transactions: (transactions.data ?? []).map((row) => ({
          type: row.type as "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT",
          status: row.status as "PENDING" | "CONFIRMED" | "CANCELLED",
          transactionDate: seoulDate(String(row.transaction_at)),
          baseAmount: toSafeInteger(row.base_amount, "transaction base_amount"),
        })),
        savingsGoals: (goals.data ?? []).map((row) => ({
          id: String(row.id),
          targetAmount: toSafeInteger(row.target_amount, "savings goal target_amount"),
          contributedBaseAmount: toSafeInteger(String(contributedByGoal.get(String(row.id)) ?? 0n), "savings goal contributed amount"),
          targetDate: String(row.target_date),
          monthlyContributionPlan: toSafeInteger(row.monthly_contribution_plan, "savings goal monthly_contribution_plan"),
          isActive: Boolean(row.is_active),
        })),
      };
    },

    async findExisting(userId, candidate, today) {
      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("dedupe_key", candidate.dedupeKey)
        .eq("dedupe_day", today)
        .limit(1);
      if (error) throwDatabaseError(error);
      return (data ?? []).length > 0;
    },

    async insert(userId, candidate, today) {
      const { data, error } = await supabase
        .from("notifications")
        .insert({ user_id: userId, ...notificationPayload(candidate, today) })
        .select("*")
        .single();
      if (error) throwDatabaseError(error);
      return mapNotification(data as NotificationRow);
    },

    async list(userId) {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throwDatabaseError(error);
      return (data as NotificationRow[]).map(mapNotification);
    },

    async markRead(userId, id) {
      const { data, error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throwDatabaseError(error);
      return data ? mapNotification(data as NotificationRow) : null;
    },
  };
}
