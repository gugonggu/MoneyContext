export type NotificationType =
  | "RECURRING_CONFIRMATION"
  | "PLANNED_DUE"
  | "CARD_PAYMENT_DUE"
  | "BUDGET_THRESHOLD"
  | "SAVINGS_RISK";

export type NotificationCandidate = Readonly<{
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
  dedupeKey: string;
}>;

export type NotificationRuleInput = Readonly<{
  /** Seoul calendar date in YYYY-MM-DD format. */
  today: string;
  pendingRecurringTransactions: readonly Readonly<{ id: string; occurrenceDate: string }>[];
  plannedTransactions: readonly Readonly<{
    id: string;
    scheduledDate: string;
    baseAmount: number;
    status?: "PLANNED" | "CONFIRMED" | "CANCELLED";
  }>[];
  cardPayments: readonly Readonly<{ accountId: string; dueDate: string }>[];
  monthlyBudgets: readonly Readonly<{ id: string; baseAmount: number }>[];
  transactions: readonly Readonly<{
    type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
    status: "PENDING" | "CONFIRMED" | "CANCELLED";
    transactionDate: string;
    baseAmount: number;
  }>[];
  savingsGoals: readonly Readonly<{
    id: string;
    targetAmount: number;
    contributedBaseAmount: number;
    targetDate: string;
    monthlyContributionPlan: number;
    isActive: boolean;
  }>[];
}>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BUDGET_THRESHOLDS = [80, 90, 100] as const;

function parseDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new RangeError("date must be YYYY-MM-DD");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError("date must be a valid YYYY-MM-DD date");
  }
  return date;
}

function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function asInteger(value: number, name: string): bigint {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be a safe integer`);
  return BigInt(value);
}

function isCurrentMonth(date: string, today: string): boolean {
  parseDate(date);
  return date.slice(0, 7) === today.slice(0, 7);
}

function savingsStatus(goal: NotificationRuleInput["savingsGoals"][number], today: string): "AT_RISK" | "OVERDUE" | null {
  const target = asInteger(goal.targetAmount, "targetAmount");
  const contributed = asInteger(goal.contributedBaseAmount, "contributedBaseAmount");
  const remaining = target > contributed ? target - contributed : 0n;
  if (remaining === 0n) return null;

  if (goal.targetDate < today) return "OVERDUE";

  const [targetYear, targetMonth] = goal.targetDate.split("-").map(Number);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const months = (targetYear - todayYear) * 12 + targetMonth - todayMonth;
  const requiredMonthly = months <= 0 ? remaining : (remaining + BigInt(months) - 1n) / BigInt(months);
  return asInteger(goal.monthlyContributionPlan, "monthlyContributionPlan") < requiredMonthly ? "AT_RISK" : null;
}

export function buildNotificationCandidates(input: NotificationRuleInput): readonly NotificationCandidate[] {
  parseDate(input.today);
  const candidates: NotificationCandidate[] = [];

  for (const transaction of input.pendingRecurringTransactions) {
    parseDate(transaction.occurrenceDate);
    candidates.push({
      type: "RECURRING_CONFIRMATION",
      title: "반복 거래 확인 필요",
      message: `${transaction.occurrenceDate} 반복 거래를 확인해 주세요.`,
      relatedEntityType: "transaction",
      relatedEntityId: transaction.id,
      dedupeKey: `recurring-confirmation:${transaction.id}:${transaction.occurrenceDate}`,
    });
  }

  for (const transaction of input.plannedTransactions) {
    if (transaction.status !== undefined && transaction.status !== "PLANNED") continue;
    parseDate(transaction.scheduledDate);
    if (transaction.scheduledDate > input.today) continue;
    candidates.push({
      type: "PLANNED_DUE",
      title: transaction.scheduledDate === input.today ? "예정 거래 예정일" : "예정 거래 기한 경과",
      message: `${transaction.scheduledDate} 예정 거래 ${transaction.baseAmount.toLocaleString("ko-KR")}원을 확인해 주세요.`,
      relatedEntityType: "planned_transaction",
      relatedEntityId: transaction.id,
      dedupeKey: `planned-due:${transaction.id}:${transaction.scheduledDate}`,
    });
  }

  const lastCardDueDate = addDays(input.today, 3);
  for (const payment of input.cardPayments) {
    parseDate(payment.dueDate);
    if (payment.dueDate < input.today || payment.dueDate > lastCardDueDate) continue;
    candidates.push({
      type: "CARD_PAYMENT_DUE",
      title: "카드 결제일 임박",
      message: `${payment.dueDate} 카드 결제일을 확인해 주세요.`,
      relatedEntityType: "account",
      relatedEntityId: payment.accountId,
      dedupeKey: `card-payment-due:${payment.accountId}:${payment.dueDate}`,
    });
  }

  const currentMonthUsage = input.transactions
    .filter((transaction) => transaction.type === "EXPENSE" && transaction.status === "CONFIRMED" && isCurrentMonth(transaction.transactionDate, input.today))
    .reduce((total, transaction) => total + asInteger(transaction.baseAmount, "transaction baseAmount"), 0n);
  const monthKey = input.today.slice(0, 7);
  for (const budget of input.monthlyBudgets) {
    const budgetAmount = asInteger(budget.baseAmount, "budget baseAmount");
    if (budgetAmount <= 0n) continue;
    for (const threshold of BUDGET_THRESHOLDS) {
      if (currentMonthUsage * 100n < budgetAmount * BigInt(threshold)) continue;
      candidates.push({
        type: "BUDGET_THRESHOLD",
        title: `예산 ${threshold}% 도달`,
        message: `이번 달 확정 지출이 예산의 ${threshold}%에 도달했습니다.`,
        relatedEntityType: "monthly_budget",
        relatedEntityId: budget.id,
        dedupeKey: `budget-threshold:${budget.id}:${monthKey}:${threshold}`,
      });
    }
  }

  for (const goal of input.savingsGoals) {
    if (!goal.isActive) continue;
    parseDate(goal.targetDate);
    const status = savingsStatus(goal, input.today);
    if (status === null) continue;
    candidates.push({
      type: "SAVINGS_RISK",
      title: status === "OVERDUE" ? "저축 목표 기한 경과" : "저축 목표 달성 위험",
      message: status === "OVERDUE" ? "저축 목표 기한이 지났습니다." : "현재 월 적립 계획으로는 목표 달성이 어렵습니다.",
      relatedEntityType: "savings_goal",
      relatedEntityId: goal.id,
      dedupeKey: `savings-risk:${goal.id}:${status}:${goal.targetDate}`,
    });
  }

  return candidates;
}
