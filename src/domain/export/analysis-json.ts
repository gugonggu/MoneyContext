import {
  actualTransactions,
  expenseNatureBreakdown,
  externalFlows,
  paymentMethodKey,
  type ActualTransaction,
  type ExportFutureCashflow,
  type ExportReadModel,
  type ExportTransaction,
} from "./markdown";
import { resolvePeriodAggregation, type PeriodAggregationStatus } from "./period";
import { resolveExpenseNature } from "./expense-nature";
import { calculateSpendComposition } from "./spend-composition";
import { calculateSpendConcentration } from "./concentration";
import { splitDeductionsByHorizon, calculateDailySpendable, calculateRemainingDaysUntilPayday, calculateSafeToSpend } from "@/domain/forecasts/spendable";
import { toSeoulDate } from "@/lib/dates/seoul";

type AmountBreakdown = Readonly<{ name: string; base_amount: number }>;

export type AnalysisJson = Readonly<{
  metadata: Readonly<{
    schema: "money-context-analysis";
    schema_version: 2;
    generated_at: string;
    base_currency: string;
    timezone: "Asia/Seoul";
    preset: string;
  }>;
  period: Readonly<{
    start_date: string;
    end_date: string;
    /** null when the selected period has not started yet - no confirmed data can exist. */
    actual_data_start_date: string | null;
    actual_data_end_date: string | null;
    status: PeriodAggregationStatus;
  }>;
  financial_position: Readonly<{
    total_assets_base_amount: number;
    total_liabilities_base_amount: number;
    credit_card_outstanding_base_amount: number;
    net_worth_base_amount: number;
  }>;
  period_summary: Readonly<{
    income_base_amount: number;
    expense_base_amount: number;
    /** @deprecated identical to period_surplus_base_amount; kept for existing consumers. */
    net_cashflow_base_amount: number;
    period_surplus_base_amount: number;
    surplus_rate: number | null;
    /** Sum of savings_contributions within the period for goals tracked in Money Context - not a user's total savings behavior. */
    savings_goal_contribution_base_amount: number;
    savings_goal_contribution_rate: number | null;
  }>;
  /** outgoing/incoming are already counted inside period_summary income/expense - do not add them again. */
  external_flows: Readonly<{ included_in_period_totals: true; outgoing_base_amount: number; incoming_base_amount: number }>;
  expense_nature: Readonly<{ recurring_base_amount: number; one_time_base_amount: number; irregular_base_amount: number; exceptional_base_amount: number; unknown_base_amount: number }>;
  spend_composition: Readonly<{ total_expense_base_amount: number; adjusted_expense_base_amount: number; habitual_base_amount: number }>;
  concentration: Readonly<{ top1_share: number | null; top3_share: number | null; top5_share: number | null; top_transactions: readonly Readonly<{ transaction_date: string; base_amount: number; category: string | null; memo: string | null }>[] }>;
  cashflow_horizon: Readonly<{ next_payday_date: string | null; near_term_confirmed_outflow_base_amount: number | null; long_term_committed_base_amount: number | null }>;
  spendable?: Readonly<{ current_liquid_assets_base_amount: number; emergency_fund_base_amount: number; near_term_confirmed_outflow_base_amount: number; safe_to_spend_base_amount: number; remaining_days_until_payday: number; daily_safe_to_spend_base_amount: number }>;
  budgets: readonly Readonly<{ name: string; allocated_base_amount: number; actual_usage_base_amount: number }>[];
  credit_cards: readonly Readonly<{ name: string; outstanding_base_amount: number; next_payment_date: string | null }>[];
  savings_goals: readonly Readonly<{ name: string; target_base_amount: number; contributed_base_amount: number; target_date: string }>[];
  planned_cashflows: readonly Readonly<{ scheduled_date: string; transaction_type: "INCOME" | "EXPENSE"; status: "PLANNED" | "CONFIRMED" | "CANCELLED"; base_amount: number; memo: string | null }>[];
  /**
   * Every future cashflow regardless of the selected period/preset above (unlike
   * planned_cashflows, which is limited to the export window). installment_remaining_base_amount
   * was already recognized as an expense at purchase time - it is future money owed
   * to the card issuer, not new spending, so do not add it to period_summary.expense_base_amount.
   */
  future_cashflows: Readonly<{
    planned_expense_base_amount: number;
    planned_income_base_amount: number;
    confirmed_future_expense_base_amount: number;
    confirmed_future_income_base_amount: number;
    installment_remaining_base_amount: number;
    installment_already_expensed_at_purchase: true;
    items: readonly Readonly<{
      source: "PLANNED" | "CONFIRMED_FUTURE" | "INSTALLMENT";
      scheduled_date: string;
      transaction_type: "INCOME" | "EXPENSE";
      base_amount: number;
      memo: string | null;
    }>[];
  }>;
  statistics: Readonly<{
    category_spending: readonly AmountBreakdown[];
    tag_spending: readonly AmountBreakdown[];
    account_spending: readonly AmountBreakdown[];
  }>;
  transactions: readonly Readonly<{
    transaction_date: string;
    transaction_type: ExportTransaction["type"];
    status: ExportTransaction["status"];
    original_amount: number | null;
    original_currency: string | null;
    base_amount: number;
    base_currency: string;
    category: string | null;
    tags: readonly string[];
    account: string | null;
    from_account: string | null;
    to_account: string | null;
    memo: string | null;
  }>[];
}>;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
}

function assertNonNegativeAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
}

function assertTransactionAmount(transaction: ExportTransaction, value: number, label: string): void {
  if (transaction.type === "ADJUSTMENT") {
    assertSafeInteger(value, label);
    return;
  }
  assertNonNegativeAmount(value, label);
}

function seoulDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("transactionDate must be a valid date-time");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function inPeriod(value: string, readModel: ExportReadModel): boolean {
  const date = seoulDate(value);
  return date >= readModel.period.startDate && date <= readModel.period.endDate;
}

function exportTransactions(readModel: ExportReadModel): readonly ExportTransaction[] {
  return readModel.transactions.filter((transaction) => inPeriod(transaction.transactionDate, readModel));
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

function sumAmounts(transactions: readonly ActualTransaction[], type: ActualTransaction["type"]): number {
  return transactions.filter((transaction) => transaction.type === type).reduce((total, transaction) => {
    assertNonNegativeAmount(transaction.baseAmount, "transaction baseAmount");
    const next = total + transaction.baseAmount;
    assertSafeInteger(next, "period summary");
    return next;
  }, 0);
}

function spendingBreakdown(transactions: readonly ActualTransaction[], keys: (transaction: ActualTransaction) => readonly string[]): readonly AmountBreakdown[] {
  const values = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== "EXPENSE") continue;
    assertNonNegativeAmount(transaction.baseAmount, "transaction baseAmount");
    for (const name of keys(transaction)) {
      const next = (values.get(name) ?? 0) + transaction.baseAmount;
      assertSafeInteger(next, "statistics base amount");
      values.set(name, next);
    }
  }
  return [...values.entries()]
    .sort(([leftName, leftAmount], [rightName, rightAmount]) => leftAmount === rightAmount ? leftName.localeCompare(rightName) : rightAmount - leftAmount)
    .map(([name, base_amount]) => ({ name, base_amount }));
}

function sumFutureCashflow(items: readonly ExportFutureCashflow[], source: ExportFutureCashflow["source"], type: "INCOME" | "EXPENSE"): number {
  return items.filter((item) => item.source === source && item.type === type).reduce((total, item) => {
    assertNonNegativeAmount(item.baseAmount, "future cashflow baseAmount");
    const next = total + item.baseAmount;
    assertSafeInteger(next, "future cashflow total");
    return next;
  }, 0);
}

export function generateAnalysisJson(readModel: ExportReadModel): AnalysisJson {
  const transactions = exportTransactions(readModel);
  const actual = actualTransactions(readModel);
  const income = sumAmounts(actual, "INCOME");
  const expense = sumAmounts(actual, "EXPENSE");
  const netCashflow = income - expense;
  assertSafeInteger(netCashflow, "period summary");
  const savingsGoalContributions = readModel.periodActualSavingsBaseAmount ?? 0;
  assertNonNegativeAmount(savingsGoalContributions, "periodActualSavingsBaseAmount");
  const position = readModel.financialPosition;
  assertNonNegativeAmount(position.totalAssets, "totalAssets");
  assertNonNegativeAmount(position.totalLiabilities, "totalLiabilities");
  assertNonNegativeAmount(position.creditCardOutstanding, "creditCardOutstanding");
  assertSafeInteger(position.netWorth, "netWorth");

  return {
    metadata: {
      schema: "money-context-analysis",
      schema_version: 2,
      generated_at: readModel.generatedAt,
      base_currency: readModel.baseCurrency,
      timezone: "Asia/Seoul",
      preset: readModel.preset,
    },
    period: (() => {
      const aggregation = resolvePeriodAggregation(readModel.period, new Date(readModel.generatedAt));
      return {
        start_date: readModel.period.startDate,
        end_date: readModel.period.endDate,
        actual_data_start_date: aggregation.actualDataStartDate,
        actual_data_end_date: aggregation.actualDataEndDate,
        status: aggregation.status,
      };
    })(),
    financial_position: {
      total_assets_base_amount: position.totalAssets,
      total_liabilities_base_amount: position.totalLiabilities,
      credit_card_outstanding_base_amount: position.creditCardOutstanding,
      net_worth_base_amount: position.netWorth,
    },
    period_summary: {
      income_base_amount: income,
      expense_base_amount: expense,
      net_cashflow_base_amount: netCashflow,
      period_surplus_base_amount: netCashflow,
      surplus_rate: rate(netCashflow, income),
      savings_goal_contribution_base_amount: savingsGoalContributions,
      savings_goal_contribution_rate: rate(savingsGoalContributions, income),
    },
    external_flows: (() => {
      const flows = externalFlows(actual);
      return { included_in_period_totals: true as const, outgoing_base_amount: flows.outgoingBaseAmount, incoming_base_amount: flows.incomingBaseAmount };
    })(),
    expense_nature: (() => {
      const nature = expenseNatureBreakdown(actual);
      return {
        recurring_base_amount: nature.RECURRING,
        one_time_base_amount: nature.ONE_TIME,
        irregular_base_amount: nature.IRREGULAR,
        exceptional_base_amount: nature.EXCEPTIONAL,
        unknown_base_amount: nature.UNKNOWN,
      };
    })(),
    spend_composition: (() => {
      const expenseTx = actual.filter((transaction) => transaction.type === "EXPENSE");
      const composition = calculateSpendComposition(expenseTx.map((transaction) => ({ baseAmount: transaction.baseAmount, nature: resolveExpenseNature(transaction) })));
      return {
        total_expense_base_amount: composition.totalExpenseBaseAmount,
        adjusted_expense_base_amount: composition.adjustedExpenseBaseAmount,
        habitual_base_amount: composition.habitualBaseAmount,
      };
    })(),
    concentration: (() => {
      const expenseTx = actual.filter((transaction) => transaction.type === "EXPENSE");
      const concentration = calculateSpendConcentration(expenseTx.map((transaction) => ({ id: transaction.id, baseAmount: transaction.baseAmount })));
      const byId = new Map(expenseTx.map((transaction) => [transaction.id, transaction]));
      return {
        top1_share: concentration.top1Share,
        top3_share: concentration.top3Share,
        top5_share: concentration.top5Share,
        top_transactions: concentration.topTransactionIds.flatMap((id) => {
          const transaction = byId.get(id);
          if (!transaction) return [];
          return [{
            transaction_date: seoulDate(transaction.transactionDate),
            base_amount: transaction.baseAmount,
            category: transaction.categoryName ?? null,
            memo: transaction.memo ?? null,
          }];
        }),
      };
    })(),
    cashflow_horizon: (() => {
      if (!readModel.nextPaydayDate) {
        return { next_payday_date: null, near_term_confirmed_outflow_base_amount: null, long_term_committed_base_amount: null };
      }
      const { nearTerm, longTerm } = splitDeductionsByHorizon(readModel.horizonDeductions ?? [], readModel.nextPaydayDate);
      const sum = (items: readonly { amount: number }[]) => items.reduce((total, item) => total + item.amount, 0);
      return {
        next_payday_date: readModel.nextPaydayDate,
        near_term_confirmed_outflow_base_amount: sum(nearTerm),
        long_term_committed_base_amount: sum(longTerm),
      };
    })(),
    ...(readModel.emergencyFundAmount !== undefined && readModel.nextPaydayDate ? {
      spendable: (() => {
        const { nearTerm } = splitDeductionsByHorizon(readModel.horizonDeductions ?? [], readModel.nextPaydayDate as string);
        const nearTermTotal = nearTerm.reduce((total, item) => total + item.amount, 0);
        const safeToSpend = calculateSafeToSpend(readModel.financialPosition.totalAssets, nearTermTotal, readModel.emergencyFundAmount as number);
        const remainingDays = calculateRemainingDaysUntilPayday(toSeoulDate(readModel.generatedAt), readModel.nextPaydayDate as string);
        // safe_to_spend_base_amount is a signed lump sum - a negative value is a
        // real signal ("사용 가능 금액이 없다"), matching the statistics page, which
        // does not clamp it either. Only the derived daily rate floors at 0.
        return {
          current_liquid_assets_base_amount: readModel.financialPosition.totalAssets,
          emergency_fund_base_amount: readModel.emergencyFundAmount as number,
          near_term_confirmed_outflow_base_amount: nearTermTotal,
          safe_to_spend_base_amount: safeToSpend,
          remaining_days_until_payday: remainingDays,
          daily_safe_to_spend_base_amount: calculateDailySpendable(safeToSpend, remainingDays),
        };
      })(),
    } : {}),
    budgets: readModel.budgets.map((budget) => {
      assertNonNegativeAmount(budget.allocatedBaseAmount, "budget allocatedBaseAmount");
      assertNonNegativeAmount(budget.actualUsageBaseAmount, "budget actualUsageBaseAmount");
      return { name: budget.name, allocated_base_amount: budget.allocatedBaseAmount, actual_usage_base_amount: budget.actualUsageBaseAmount };
    }),
    credit_cards: (readModel.creditCards ?? []).map((card) => {
      assertNonNegativeAmount(card.outstandingBaseAmount, "credit card outstandingBaseAmount");
      return { name: card.name, outstanding_base_amount: card.outstandingBaseAmount, next_payment_date: card.nextPaymentDate ?? null };
    }),
    savings_goals: readModel.savingsGoals.map((goal) => {
      assertNonNegativeAmount(goal.targetBaseAmount, "savings goal targetBaseAmount");
      assertNonNegativeAmount(goal.contributedBaseAmount, "savings goal contributedBaseAmount");
      return { name: goal.name, target_base_amount: goal.targetBaseAmount, contributed_base_amount: goal.contributedBaseAmount, target_date: goal.targetDate };
    }),
    planned_cashflows: readModel.plannedCashflows.filter((flow) => flow.status === "PLANNED").map((flow) => {
      assertNonNegativeAmount(flow.baseAmount, "planned cashflow baseAmount");
      return { scheduled_date: flow.scheduledDate, transaction_type: flow.type, status: flow.status, base_amount: flow.baseAmount, memo: flow.memo ?? null };
    }),
    future_cashflows: (() => {
      const items = readModel.futureCashflows ?? [];
      return {
        planned_expense_base_amount: sumFutureCashflow(items, "PLANNED", "EXPENSE"),
        planned_income_base_amount: sumFutureCashflow(items, "PLANNED", "INCOME"),
        confirmed_future_expense_base_amount: sumFutureCashflow(items, "CONFIRMED_FUTURE", "EXPENSE"),
        confirmed_future_income_base_amount: sumFutureCashflow(items, "CONFIRMED_FUTURE", "INCOME"),
        installment_remaining_base_amount: sumFutureCashflow(items, "INSTALLMENT", "EXPENSE"),
        installment_already_expensed_at_purchase: true as const,
        items: items.map((item) => {
          assertNonNegativeAmount(item.baseAmount, "future cashflow baseAmount");
          return {
            source: item.source,
            scheduled_date: item.scheduledDate,
            transaction_type: item.type,
            base_amount: item.baseAmount,
            memo: item.memo ?? null,
          };
        }),
      };
    })(),
    statistics: {
      category_spending: spendingBreakdown(actual, (transaction) => [transaction.categoryName ?? "Uncategorized"]),
      tag_spending: spendingBreakdown(actual, (transaction) => transaction.tagNames ?? []),
      account_spending: spendingBreakdown(actual, (transaction) => [paymentMethodKey(transaction)]),
    },
    transactions: transactions.map((transaction) => {
      assertTransactionAmount(transaction, transaction.baseAmount, "transaction baseAmount");
      if (transaction.originalAmount !== undefined) assertTransactionAmount(transaction, transaction.originalAmount, "transaction originalAmount");
      return {
        transaction_date: seoulDate(transaction.transactionDate),
        transaction_type: transaction.type,
        status: transaction.status,
        original_amount: transaction.originalAmount ?? null,
        original_currency: transaction.originalCurrency ?? null,
        base_amount: transaction.baseAmount,
        base_currency: readModel.baseCurrency,
        category: transaction.categoryName ?? null,
        tags: transaction.tagNames ?? [],
        account: transaction.accountName ?? null,
        from_account: transaction.fromAccountName ?? null,
        to_account: transaction.toAccountName ?? null,
        memo: transaction.memo ?? null,
      };
    }),
  };
}
