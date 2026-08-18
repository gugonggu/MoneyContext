import { describe, expect, it } from "vitest";
import { calculateSafeToSpend, splitDeductionsByHorizon, type HorizonDeduction } from "@/domain/forecasts/spendable";

describe("splitDeductionsByHorizon", () => {
  it("cutoffDate 이전/이후 확정 현금유출을 분리한다", () => {
    const deductions: HorizonDeduction[] = [
      { amount: 100_000, provenance: "card:visa", dueDate: "2026-08-25" },
      { amount: 120_000, provenance: "installment:seq-4", dueDate: "2026-11-25" },
    ];
    const result = splitDeductionsByHorizon(deductions, "2026-09-01");
    expect(result.nearTerm.map((item) => item.provenance)).toEqual(["card:visa"]);
    expect(result.longTerm.map((item) => item.provenance)).toEqual(["installment:seq-4"]);
  });

  it("cutoffDate와 같은 날짜는 근거리(nearTerm)로 취급한다", () => {
    const deductions: HorizonDeduction[] = [{ amount: 50_000, provenance: "card:visa", dueDate: "2026-09-01" }];
    const result = splitDeductionsByHorizon(deductions, "2026-09-01");
    expect(result.nearTerm).toHaveLength(1);
    expect(result.longTerm).toHaveLength(0);
  });
});

describe("calculateSafeToSpend", () => {
  it("Case E: 자산 500,000 / 확정지출 100,000 / 비상금 200,000 -> 200,000", () => {
    expect(calculateSafeToSpend(500_000, 100_000, 200_000)).toBe(200_000);
  });

  it("음수가 되어도 그대로 반환한다(사용 가능 금액이 없다는 신호)", () => {
    expect(calculateSafeToSpend(100_000, 100_000, 200_000)).toBe(-200_000);
  });
});
