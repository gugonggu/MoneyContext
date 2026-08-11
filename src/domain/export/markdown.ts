import { type ExportPeriod } from "@/domain/export/period";
import { exportPresets, isExportPreset, type ExportPreset } from "@/domain/export/presets";

type ActualTransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
type TransactionStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export type ExportTransaction = Readonly<{
  id: string;
  transactionDate: string;
  type: ActualTransactionType;
  status: TransactionStatus;
  baseAmount: number;
  categoryName?: string;
  accountName?: string;
  tagNames?: readonly string[];
  memo?: string;
}>;

export type ExportReadModel = Readonly<{
  generatedAt: string;
  baseCurrency: string;
  period: ExportPeriod;
  preset: ExportPreset;
  financialPosition: Readonly<{
    totalAssets: number;
    totalLiabilities: number;
    creditCardOutstanding: number;
    netWorth: number;
  }>;
  transactions: readonly ExportTransaction[];
  budgets: readonly Readonly<{ name: string; allocatedBaseAmount: number; actualUsageBaseAmount: number }>[];
  plannedCashflows: readonly Readonly<{
    scheduledDate: string;
    type: "INCOME" | "EXPENSE";
    status: "PLANNED" | "CONFIRMED" | "CANCELLED";
    baseAmount: number;
    memo?: string;
  }>[];
  savingsGoals: readonly Readonly<{
    name: string;
    targetBaseAmount: number;
    contributedBaseAmount: number;
    targetDate: string;
  }>[];
  creditCards?: readonly Readonly<{ name: string; outstandingBaseAmount: number; nextPaymentDate?: string | null }>[];
}>;

type ActualTransaction = ExportTransaction & Readonly<{ type: "INCOME" | "EXPENSE" }>;

function assertSafeAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
}

function sumAmounts(values: readonly number[], label: string): bigint {
  return values.reduce((total, value) => {
    assertSafeAmount(value, label);
    return total + BigInt(value);
  }, 0n);
}

function formatMoney(value: bigint, currency: string): string {
  return `${value.toLocaleString("en-US")} ${currency}`;
}

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function inPeriod(value: string, period: ExportPeriod): boolean {
  const key = dateKey(value);
  return key >= period.startDate && key <= period.endDate;
}

function actualTransactions(readModel: ExportReadModel): ActualTransaction[] {
  return readModel.transactions.filter((transaction): transaction is ActualTransaction => (
    transaction.status === "CONFIRMED"
    && (transaction.type === "INCOME" || transaction.type === "EXPENSE")
    && inPeriod(transaction.transactionDate, readModel.period)
  ));
}

function breakdown(transactions: readonly ActualTransaction[], key: (transaction: ActualTransaction) => readonly string[]): readonly [string, bigint][] {
  const values = new Map<string, bigint>();
  for (const transaction of transactions) {
    if (transaction.type !== "EXPENSE") continue;
    assertSafeAmount(transaction.baseAmount, "transaction baseAmount");
    for (const name of key(transaction)) values.set(name, (values.get(name) ?? 0n) + BigInt(transaction.baseAmount));
  }
  return [...values.entries()].sort(([leftName, leftAmount], [rightName, rightAmount]) => (
    leftAmount === rightAmount ? leftName.localeCompare(rightName) : leftAmount > rightAmount ? -1 : 1
  ));
}

function listBreakdown(title: string, entries: readonly [string, bigint][], currency: string): string[] {
  return [title, ...(entries.length === 0 ? ["- 해당 없음"] : entries.map(([name, amount]) => `- ${name}: ${formatMoney(amount, currency)}`)), ""];
}

function percentage(numerator: bigint, denominator: bigint): string {
  if (denominator === 0n) return "계산 불가";
  return `${(numerator * 100n + denominator / 2n) / denominator}%`;
}

function financialPositionLines(readModel: ExportReadModel): string[] {
  const position = readModel.financialPosition;
  assertSafeAmount(position.totalAssets, "totalAssets");
  assertSafeAmount(position.totalLiabilities, "totalLiabilities");
  assertSafeAmount(position.creditCardOutstanding, "creditCardOutstanding");
  assertSafeInteger(position.netWorth, "netWorth");
  return [
    "## 재정 상태",
    `- 총 자산: ${formatMoney(BigInt(position.totalAssets), readModel.baseCurrency)}`,
    `- 총 부채: ${formatMoney(BigInt(position.totalLiabilities), readModel.baseCurrency)}`,
    `- 카드 미결제: ${formatMoney(BigInt(position.creditCardOutstanding), readModel.baseCurrency)}`,
    `- 순자산: ${formatMoney(BigInt(position.netWorth), readModel.baseCurrency)}`,
    "",
  ];
}

function budgetLines(readModel: ExportReadModel): string[] {
  const rows = readModel.budgets.map((budget) => {
    assertSafeAmount(budget.allocatedBaseAmount, "budget allocatedBaseAmount");
    assertSafeAmount(budget.actualUsageBaseAmount, "budget actualUsageBaseAmount");
    return `- ${budget.name}: 예산 ${formatMoney(BigInt(budget.allocatedBaseAmount), readModel.baseCurrency)}, 실제 사용 ${formatMoney(BigInt(budget.actualUsageBaseAmount), readModel.baseCurrency)}`;
  });
  return ["## 예산", ...(rows.length === 0 ? ["- 설정된 예산이 없습니다."] : rows), ""];
}

function plannedCashflowLines(readModel: ExportReadModel): string[] {
  const rows = readModel.plannedCashflows.filter((flow) => flow.status === "PLANNED").map((flow) => {
    assertSafeAmount(flow.baseAmount, "planned cashflow baseAmount");
    return `- ${flow.scheduledDate}: ${flow.type === "INCOME" ? "예정 수입" : "예정 지출"} ${formatMoney(BigInt(flow.baseAmount), readModel.baseCurrency)}${flow.memo ? ` (${flow.memo})` : ""}`;
  });
  return ["## 예정된 현금흐름", ...(rows.length === 0 ? ["- 확정 전 예정 거래가 없습니다."] : rows), ""];
}

function savingsGoalLines(readModel: ExportReadModel): string[] {
  const rows = readModel.savingsGoals.map((goal) => {
    assertSafeAmount(goal.targetBaseAmount, "savings goal targetBaseAmount");
    assertSafeAmount(goal.contributedBaseAmount, "savings goal contributedBaseAmount");
    return `- ${goal.name}: ${formatMoney(BigInt(goal.contributedBaseAmount), readModel.baseCurrency)} / ${formatMoney(BigInt(goal.targetBaseAmount), readModel.baseCurrency)} (목표일 ${goal.targetDate})`;
  });
  return ["## 저축 목표", ...(rows.length === 0 ? ["- 활성 저축 목표가 없습니다."] : rows), ""];
}

function cardLines(readModel: ExportReadModel): string[] {
  const rows = (readModel.creditCards ?? []).map((card) => {
    assertSafeAmount(card.outstandingBaseAmount, "credit card outstandingBaseAmount");
    return `- ${card.name}: 미결제 ${formatMoney(BigInt(card.outstandingBaseAmount), readModel.baseCurrency)}${card.nextPaymentDate ? ` (다음 결제일 ${card.nextPaymentDate})` : ""}`;
  });
  return ["## 카드 현황", ...(rows.length === 0 ? ["- 등록된 신용카드가 없습니다."] : rows), ""];
}

function transactionLines(transactions: readonly ActualTransaction[], currency: string): string[] {
  const rows = transactions.map((transaction) => {
    assertSafeAmount(transaction.baseAmount, "transaction baseAmount");
    const details = [transaction.categoryName, transaction.accountName, transaction.memo].filter(Boolean).join(" · ");
    return `- ${dateKey(transaction.transactionDate)}: ${transaction.type === "INCOME" ? "수입" : "지출"} ${formatMoney(BigInt(transaction.baseAmount), currency)}${details ? ` (${details})` : ""}`;
  });
  return ["## 거래 내역", ...(rows.length === 0 ? ["- 기간 내 확정 수입 또는 지출 거래가 없습니다."] : rows), ""];
}

export function generateExportMarkdown(readModel: ExportReadModel): string {
  if (!isExportPreset(readModel.preset)) throw new RangeError("unsupported export preset");
  const transactions = actualTransactions(readModel);
  const income = sumAmounts(transactions.filter((transaction) => transaction.type === "INCOME").map((transaction) => transaction.baseAmount), "transaction baseAmount");
  const expense = sumAmounts(transactions.filter((transaction) => transaction.type === "EXPENSE").map((transaction) => transaction.baseAmount), "transaction baseAmount");
  const sections = exportPresets[readModel.preset].sections;
  const lines = [
    "# Money Context 재정 데이터",
    "",
    `생성일: ${readModel.generatedAt}`,
    `기준 통화: ${readModel.baseCurrency}`,
    `분석 기간: ${readModel.period.startDate} ~ ${readModel.period.endDate}`,
    `분석 목적: ${exportPresets[readModel.preset].purpose}`,
    "",
    ...financialPositionLines(readModel),
    "## 기간 내 현황",
    `- 수입: ${formatMoney(income, readModel.baseCurrency)}`,
    `- 지출: ${formatMoney(expense, readModel.baseCurrency)}`,
    `- 저축: ${formatMoney(income - expense, readModel.baseCurrency)}`,
    `- 저축률: ${percentage(income - expense, income)}`,
    "",
  ];
  if (sections.includes("BUDGETS")) lines.push(...budgetLines(readModel));
  if (sections.includes("CATEGORY_SPENDING")) lines.push(...listBreakdown("## 카테고리별 소비", breakdown(transactions, (transaction) => [transaction.categoryName ?? "미분류"]), readModel.baseCurrency));
  if (sections.includes("TAG_SPENDING")) lines.push(...listBreakdown("## 태그별 소비", breakdown(transactions, (transaction) => transaction.tagNames ?? []), readModel.baseCurrency));
  if (sections.includes("PAYMENT_METHODS")) lines.push(...listBreakdown("## 결제수단별 소비", breakdown(transactions, (transaction) => [transaction.accountName ?? "미지정"]), readModel.baseCurrency));
  if (sections.includes("CARDS")) lines.push(...cardLines(readModel));
  if (sections.includes("SAVINGS_GOALS")) lines.push(...savingsGoalLines(readModel));
  if (sections.includes("PLANNED_CASHFLOWS")) lines.push(...plannedCashflowLines(readModel));
  if (sections.includes("TRANSACTIONS")) lines.push(...transactionLines(transactions, readModel.baseCurrency));
  lines.push(
    "## 데이터 해석 주의사항",
    "- 이체는 수입/지출에 포함하지 않습니다.",
    "- 카드대금 납부는 추가 소비가 아닙니다.",
    "- 신용카드 구매 소비는 구매일에 전액 인식합니다.",
    "- 할부 회차는 소비가 아니라 미래 결제 현금흐름입니다.",
    "- 잔액조정은 수입/소비 통계에 포함하지 않습니다.",
    "- 예정 거래는 실제 소비가 아니며 미래 계획으로만 반영합니다.",
    "- 과거 외화 거래 분석은 거래 시점에 저장된 base_amount를 사용합니다.",
  );
  return `${lines.join("\n")}\n`;
}
