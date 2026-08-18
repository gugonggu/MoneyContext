import { describe, expect, it } from "vitest";
import { calculateSpendComposition } from "@/domain/export/spend-composition";

describe("calculateSpendComposition", () => {
  it("Case B: 예외 소비를 제외한 조정 소비를 계산한다", () => {
    const result = calculateSpendComposition([
      { baseAmount: 200_000, nature: "UNKNOWN" },
      { baseAmount: 100_000, nature: "UNKNOWN" },
      { baseAmount: 600_000, nature: "EXCEPTIONAL" },
    ]);
    expect(result.totalExpenseBaseAmount).toBe(900_000);
    expect(result.exceptionalBaseAmount).toBe(600_000);
    expect(result.adjustedExpenseBaseAmount).toBe(300_000);
  });

  it("Case C: 일회성 소비는 공식 총 소비에 포함된 채 별도로도 집계된다", () => {
    const result = calculateSpendComposition([
      { baseAmount: 300_000, nature: "RECURRING" },
      { baseAmount: 120_000, nature: "ONE_TIME" },
    ]);
    expect(result.totalExpenseBaseAmount).toBe(420_000);
    expect(result.oneTimeBaseAmount).toBe(120_000);
    expect(result.adjustedExpenseBaseAmount).toBe(420_000);
  });

  it("평소/생활 소비는 RECURRING과 IRREGULAR만 포함한다", () => {
    const result = calculateSpendComposition([
      { baseAmount: 100_000, nature: "RECURRING" },
      { baseAmount: 50_000, nature: "IRREGULAR" },
      { baseAmount: 70_000, nature: "ONE_TIME" },
      { baseAmount: 30_000, nature: "UNKNOWN" },
      { baseAmount: 600_000, nature: "EXCEPTIONAL" },
    ]);
    expect(result.habitualBaseAmount).toBe(150_000);
    expect(result.natureBreakdown).toEqual({
      RECURRING: 100_000,
      ONE_TIME: 70_000,
      IRREGULAR: 50_000,
      EXCEPTIONAL: 600_000,
      UNKNOWN: 30_000,
    });
  });

  it("Case A: 예외/일회성 거래가 없는 평범한 달은 소비 구조가 전부 평소 소비로 채워진다", () => {
    const result = calculateSpendComposition([
      { baseAmount: 300_000, nature: "RECURRING" },
      { baseAmount: 80_000, nature: "RECURRING" },
      { baseAmount: 15_000, nature: "UNKNOWN" },
    ]);
    expect(result.totalExpenseBaseAmount).toBe(395_000);
    expect(result.exceptionalBaseAmount).toBe(0);
    expect(result.oneTimeBaseAmount).toBe(0);
    expect(result.adjustedExpenseBaseAmount).toBe(395_000);
    expect(result.habitualBaseAmount).toBe(380_000);
  });

  it("빈 입력에서도 안전한 0을 반환한다", () => {
    const result = calculateSpendComposition([]);
    expect(result.totalExpenseBaseAmount).toBe(0);
    expect(result.adjustedExpenseBaseAmount).toBe(0);
  });
});
