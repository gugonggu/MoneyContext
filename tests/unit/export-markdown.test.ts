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

  it("renders the stable header, financial position, and period summary", () => {
    const markdown = generateExportMarkdown(readModel());

    expect(markdown).toContain("# Money Context 재정 데이터");
    expect(markdown).toContain("생성일: 2026-08-11T12:00:00+09:00");
    expect(markdown).toContain("기준 통화: KRW");
    expect(markdown).toContain("분석 기간: 2026-08-01 ~ 2026-08-31");
    expect(markdown).toContain("## 재정 상태");
    expect(markdown).toContain("- 순자산: 3,800,000 KRW");
    expect(markdown).toContain("## 기간 내 현황");
    expect(markdown).toContain("- 저축률: 100%");
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

    expect(markdown).toContain("이체는 수입/지출에 포함하지 않습니다.");
    expect(markdown).toContain("카드대금 납부는 추가 소비가 아닙니다.");
    expect(markdown).toContain("신용카드 구매 소비는 구매일에 전액 인식합니다.");
    expect(markdown).toContain("할부 회차는 소비가 아니라 미래 결제 현금흐름입니다.");
    expect(markdown).toContain("잔액조정은 수입/소비 통계에 포함하지 않습니다.");
    expect(markdown).toContain("예정 거래는 실제 소비가 아니며 미래 계획으로만 반영합니다.");
    expect(markdown).toContain("과거 외화 거래 분석은 거래 시점에 저장된 base_amount를 사용합니다.");
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
