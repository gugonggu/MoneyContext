import { describe, expect, it } from "vitest";

import { generateExportMarkdown, type ExportReadModel } from "@/domain/export/markdown";
import { type ExportPreset } from "@/domain/export/presets";

function readModel(overrides: Partial<ExportReadModel> = {}): ExportReadModel {
  return {
    generatedAt: "2026-08-11T12:00:00+09:00",
    baseCurrency: "KRW",
    period: { startDate: "2026-08-01", endDate: "2026-08-31" },
    preset: "SPENDING_REVIEW",
    financialPosition: {
      totalAssets: 5_000_000,
      totalLiabilities: 1_000_000,
      creditCardOutstanding: 200_000,
      netWorth: 3_800_000,
    },
    transactions: [
      { id: "income", transactionDate: "2026-08-01", type: "INCOME", status: "CONFIRMED", baseAmount: 3_000_000 },
      { id: "expense", transactionDate: "2026-08-02", type: "EXPENSE", status: "CONFIRMED", originalAmount: 10, originalCurrency: "USD", baseAmount: 1_500, categoryName: "식비", accountName: "신용카드", tagNames: ["점심"], memo: "외화 결제" },
      { id: "transfer", transactionDate: "2026-08-03", type: "TRANSFER", status: "CONFIRMED", baseAmount: 900_000, memo: "카드대금 납부" },
      { id: "adjustment", transactionDate: "2026-08-04", type: "ADJUSTMENT", status: "CONFIRMED", baseAmount: 90_000 },
      { id: "pending", transactionDate: "2026-08-05", type: "EXPENSE", status: "PENDING", baseAmount: 500_000 },
      { id: "outside-period", transactionDate: "2026-07-31", type: "EXPENSE", status: "CONFIRMED", baseAmount: 20_000 },
    ],
    budgets: [{ name: "8월 생활비", allocatedBaseAmount: 500_000, actualUsageBaseAmount: 1_500 }],
    plannedCashflows: [{ scheduledDate: "2026-08-20", type: "EXPENSE", status: "PLANNED", baseAmount: 80_000, memo: "통신비" }],
    savingsGoals: [{ name: "비상금", targetBaseAmount: 10_000_000, contributedBaseAmount: 2_000_000, targetDate: "2027-01-01" }],
    ...overrides,
  };
}

describe("generateExportMarkdown", () => {
  it("renders stored base amounts for confirmed actual income and expense only", () => {
    const markdown = generateExportMarkdown(readModel());

    expect(markdown).toContain("- 수입: 3,000,000 KRW");
    expect(markdown).toContain("- 지출: 1,500 KRW");
    expect(markdown).toContain("- 식비: 1,500 KRW");
    expect(markdown).not.toContain("10 USD");
    expect(markdown).not.toContain("900,000 KRW");
    expect(markdown).not.toContain("90,000 KRW");
    expect(markdown).not.toContain("500,000 KRW");
    expect(markdown).not.toContain("20,000 KRW");
  });

  it("counts a one-sided TRANSFER out as an expense and one-sided TRANSFER in as income", () => {
    const markdown = generateExportMarkdown(readModel({
      transactions: [
        { id: "transfer-out", transactionDate: "2026-08-06", type: "TRANSFER", status: "CONFIRMED", baseAmount: 50_000, fromAccountName: "부산은행", memo: "친구에게 송금" },
        { id: "transfer-in", transactionDate: "2026-08-07", type: "TRANSFER", status: "CONFIRMED", baseAmount: 30_000, toAccountName: "부산은행", memo: "친구에게 받음" },
      ],
    }));

    expect(markdown).toContain("- 수입: 30,000 KRW");
    expect(markdown).toContain("- 지출: 50,000 KRW");
    expect(markdown).toContain("친구에게 송금");
    expect(markdown).toContain("친구에게 받음");
  });

  it("still excludes a TRANSFER between two of the user's own accounts (both sides present)", () => {
    const markdown = generateExportMarkdown(readModel({
      transactions: [
        { id: "internal-transfer", transactionDate: "2026-08-06", type: "TRANSFER", status: "CONFIRMED", baseAmount: 900_000, fromAccountName: "부산은행", toAccountName: "신용카드" },
      ],
    }));

    expect(markdown).toContain("- 수입: 0 KRW");
    expect(markdown).toContain("- 지출: 0 KRW");
    expect(markdown).not.toContain("900,000 KRW");
  });

  it("renders the stable header, financial position, and period summary", () => {
    const markdown = generateExportMarkdown(readModel());

    expect(markdown).toContain("# Money Context 재정 데이터");
    expect(markdown).toContain("생성일: 2026-08-11T12:00:00+09:00");
    expect(markdown).toContain("기준 통화: KRW");
    expect(markdown).toContain("분석 기간: 2026-08-01 ~ 2026-08-31");
    expect(markdown).toContain("## 재정 상태");
    expect(markdown).toContain("- 순자산: 3,800,000 KRW");
    expect(markdown).toContain("## 기간 내 현황");
    expect(markdown).toContain("- 기간 잉여금: 2,998,500 KRW");
    expect(markdown).toContain("- 수입 대비 잉여율: 100%");
    expect(markdown).toContain("- 저축 목표 적립액: 0 KRW");
    expect(markdown).toContain("- 저축 목표 적립률: 0%");
  });

  it("renders a negative net worth without treating it as an invalid amount", () => {
    const markdown = generateExportMarkdown(readModel({
      financialPosition: {
        totalAssets: 100_000,
        totalLiabilities: 200_000,
        creditCardOutstanding: 50_000,
        netWorth: -150_000,
      },
    }));

    expect(markdown).toContain("- 순자산: -150,000 KRW");
  });

  it.each<ExportPreset>(["SPENDING_REVIEW", "BUDGET_REVIEW", "FINANCIAL_HEALTH"])("renders the sections for the %s preset", (preset) => {
    const markdown = generateExportMarkdown(readModel({ preset }));

    if (preset === "SPENDING_REVIEW") {
      expect(markdown).toContain("## 카테고리별 소비");
      expect(markdown).toContain("## 태그별 소비");
      expect(markdown).not.toContain("## 예산");
    }
    if (preset === "BUDGET_REVIEW") {
      expect(markdown).toContain("## 예산");
      expect(markdown).toContain("## 카테고리별 소비");
      expect(markdown).toContain("## 예정된 현금흐름");
    }
    if (preset === "FINANCIAL_HEALTH") {
      expect(markdown).toContain("## 카테고리별 소비");
      expect(markdown).toContain("## 카드 현황");
      expect(markdown).toContain("## 저축 목표");
      expect(markdown).toContain("## 예정된 현금흐름");
    }
  });

  it("states that an empty actual period has no transactions", () => {
    const markdown = generateExportMarkdown(readModel({ transactions: [] }));

    expect(markdown).toContain("- 수입: 0 KRW");
    expect(markdown).toContain("- 지출: 0 KRW");
    expect(markdown).toContain("기간 내 확정 수입 또는 지출 거래가 없습니다.");
  });

  it("includes the mandatory financial-rule notes", () => {
    const markdown = generateExportMarkdown(readModel());

    expect(markdown).toContain("내 계좌 간 이체(양쪽 다 내 소유 계좌)는 수입/지출에 포함하지 않습니다.");
    expect(markdown).toContain("외부로 보내거나 외부에서 받은 이체(한쪽만 내 계좌)는 각각 지출/수입에 포함합니다.");
    expect(markdown).toContain("카드대금 납부는 추가 소비가 아닙니다.");
    expect(markdown).toContain("신용카드 구매 소비는 구매일에 전액 인식합니다.");
    expect(markdown).toContain("할부 회차는 소비가 아니라 미래 결제 현금흐름입니다.");
    expect(markdown).toContain("잔액조정은 수입/소비 통계에 포함하지 않습니다.");
    expect(markdown).toContain("예정 거래는 실제 소비가 아니며 미래 계획으로만 반영합니다.");
    expect(markdown).toContain("과거 외화 거래 분석은 거래 시점에 저장된 base_amount를 사용합니다.");
    expect(markdown).toContain("외부 자금 이동(외부 송금/외부 수입)은 위 기간 수입/지출에 이미 포함된 부분집합이며, 총 수입/지출에 별도로 더해서 계산하지 않습니다.");
    expect(markdown).toContain("기간 잉여금은 저축 목표 적립액이 아닙니다.");
    expect(markdown).toContain("저축 목표 적립액은 Money Context 저축 목표에 연결된 적립 내역만 의미하며");
    expect(markdown).toContain("'미지정'은 결제수단 정보가 누락된 거래이며, '외부 자금 이동'은 계좌 정보가 없는 외부 송금/수입입니다.");
    expect(markdown).toContain("반복성 지출은 반복 거래 규칙에서 생성되었거나 사용자가 명시적으로 반복성으로 지정한 거래를 의미합니다.");
    expect(markdown).toContain("예정 거래라는 이유만으로 반복성 지출로 분류하지 않습니다.");
    expect(markdown).toContain("분류되지 않은 지출은 반복 여부를 확인할 근거가 부족한 거래이며, 일회성이라는 의미가 아닙니다.");
    expect(markdown).toContain("카테고리는 소비 대상(무엇에 사용했는가), 태그는 소비 맥락(왜/어떤 상황에서 사용했는가)을 나타냅니다.");
  });

  it("reports the period surplus separately from actual savings contributions", () => {
    const markdown = generateExportMarkdown(readModel({ periodActualSavingsBaseAmount: 100_000 }));

    expect(markdown).toContain("- 수입: 3,000,000 KRW");
    expect(markdown).toContain("- 지출: 1,500 KRW");
    expect(markdown).toContain("- 기간 잉여금: 2,998,500 KRW");
    expect(markdown).toContain("- 저축 목표 적립액: 100,000 KRW");
    expect(markdown).not.toContain("- 저축:");
    expect(markdown).not.toContain("- 저축률:");
  });

  it("attributes an external transfer-out with a known source account to that account, not to 미지정", () => {
    const markdown = generateExportMarkdown(readModel({
      transactions: [
        { id: "missing-account", transactionDate: "2026-08-06", type: "EXPENSE", status: "CONFIRMED", baseAmount: 12_000, categoryName: "식비" },
        { id: "transfer-out-known-account", transactionDate: "2026-08-07", type: "TRANSFER", status: "CONFIRMED", baseAmount: 600_000, fromAccountName: "부산은행", memo: "부모님 송금" },
      ],
    }));

    expect(markdown).toContain("- 미지정: 12,000 KRW");
    expect(markdown).toContain("- 부산은행: 600,000 KRW");
    expect(markdown).not.toMatch(/- 미지정: 612,000 KRW/);
    expect(markdown).toContain("## 외부 자금 이동");
    expect(markdown).toContain("- 외부 송금: 600,000 KRW");
  });

  it("counts an external one-sided TRANSFER-in as income for the external flows summary", () => {
    const markdown = generateExportMarkdown(readModel({
      transactions: [
        { id: "transfer-in", transactionDate: "2026-08-07", type: "TRANSFER", status: "CONFIRMED", baseAmount: 13_060, toAccountName: "부산은행", memo: "정산금 수령" },
      ],
    }));

    expect(markdown).toContain("- 외부 수입: 13,060 KRW");
  });

  it("classifies expense nature from recurring rule and planned transaction origin, defaulting to unknown", () => {
    const markdown = generateExportMarkdown(readModel({
      transactions: [
        { id: "recurring", transactionDate: "2026-08-05", type: "EXPENSE", status: "CONFIRMED", baseAmount: 14_900, recurringRuleId: "rule-1", categoryName: "구독" },
        { id: "one-time", transactionDate: "2026-08-06", type: "EXPENSE", status: "CONFIRMED", baseAmount: 600_000, plannedTransactionId: "plan-1", categoryName: "경조사" },
        { id: "unknown", transactionDate: "2026-08-07", type: "EXPENSE", status: "CONFIRMED", baseAmount: 56_678, categoryName: "생활" },
      ],
    }));

    expect(markdown).toContain("## 소비 성격");
    expect(markdown).toContain("- 반복성 지출: 14,900 KRW");
    expect(markdown).toContain("- 일회성 지출: 600,000 KRW");
    expect(markdown).toContain("- 분류되지 않은 지출: 56,678 KRW");
  });

  it("does not classify a one-off planned transaction as RECURRING just because it was scheduled ahead of time", () => {
    const markdown = generateExportMarkdown(readModel({
      transactions: [
        { id: "car-repair", transactionDate: "2026-08-06", type: "EXPENSE", status: "CONFIRMED", baseAmount: 300_000, plannedTransactionId: "plan-car-repair", categoryName: "차량", memo: "차량 수리" },
      ],
    }));

    expect(markdown).toContain("- 일회성 지출: 300,000 KRW");
    expect(markdown).toContain("- 반복성 지출: 0 KRW");
  });

  it("does not add external outgoing transfers on top of the period expense total", () => {
    const markdown = generateExportMarkdown(readModel({
      transactions: [
        { id: "expense", transactionDate: "2026-08-01", type: "EXPENSE", status: "CONFIRMED", baseAmount: 400_000, categoryName: "생활" },
        { id: "transfer-out", transactionDate: "2026-08-06", type: "TRANSFER", status: "CONFIRMED", baseAmount: 600_000, fromAccountName: "부산은행" },
      ],
    }));

    expect(markdown).toContain("- 지출: 1,000,000 KRW");
    expect(markdown).toContain("- 외부 송금: 600,000 KRW");
    expect(markdown).not.toContain("1,600,000 KRW");
  });

  it("does not guess ONE_TIME for an ordinary transaction with no recurring or planned origin", () => {
    const markdown = generateExportMarkdown(readModel({
      transactions: [
        { id: "ordinary", transactionDate: "2026-08-05", type: "EXPENSE", status: "CONFIRMED", baseAmount: 117_000, categoryName: "쇼핑", memo: "키보드" },
      ],
    }));

    expect(markdown).toContain("- 분류되지 않은 지출: 117,000 KRW");
    expect(markdown).toContain("- 일회성 지출: 0 KRW");
  });

  it("rejects an unsupported preset supplied at runtime", () => {
    expect(() => generateExportMarkdown(readModel({ preset: "toString" as ExportPreset }))).toThrow(RangeError);
  });

  it("uses the Asia/Seoul date at a UTC month boundary for filtering and rendering", () => {
    const markdown = generateExportMarkdown(readModel({
      transactions: [
        { id: "seoul-start", transactionDate: "2026-07-31T15:00:00.000Z", type: "EXPENSE", status: "CONFIRMED", baseAmount: 1_500, categoryName: "식비" },
        { id: "before-seoul-start", transactionDate: "2026-07-31T14:59:59.999Z", type: "EXPENSE", status: "CONFIRMED", baseAmount: 2_000, categoryName: "식비" },
      ],
    }));

    expect(markdown).toContain("- 지출: 1,500 KRW");
    expect(markdown).toContain("- 2026-08-01: 지출 1,500 KRW");
    expect(markdown).not.toContain("2,000 KRW");
  });
});
