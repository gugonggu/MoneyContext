import { describe, expect, it } from "vitest";
import { calculateSpendConcentration } from "@/domain/export/concentration";

describe("calculateSpendConcentration", () => {
  it("금액 내림차순 상위 1/3/5개 비중을 계산한다", () => {
    const result = calculateSpendConcentration([
      { id: "family", baseAmount: 600_000 },
      { id: "gym", baseAmount: 360_000 },
      { id: "keyboard", baseAmount: 117_000 },
      { id: "food-1", baseAmount: 50_000 },
      { id: "food-2", baseAmount: 30_000 },
      { id: "food-3", baseAmount: 20_000 },
    ]);
    const total = 600_000 + 360_000 + 117_000 + 50_000 + 30_000 + 20_000;
    expect(result.top1Share).toBeCloseTo(600_000 / total, 6);
    expect(result.top3Share).toBeCloseTo((600_000 + 360_000 + 117_000) / total, 6);
    expect(result.top5Share).toBeCloseTo((total - 20_000) / total, 6);
    expect(result.topTransactionIds).toEqual(["family", "gym", "keyboard", "food-1", "food-2"]);
  });

  it("지출 거래가 없으면 null을 반환하고 0으로 위장하지 않는다", () => {
    const result = calculateSpendConcentration([]);
    expect(result.top1Share).toBeNull();
    expect(result.top3Share).toBeNull();
    expect(result.top5Share).toBeNull();
    expect(result.topTransactionIds).toEqual([]);
  });

  it("거래가 5건 미만이면 있는 만큼만 top5에 포함한다", () => {
    const result = calculateSpendConcentration([{ id: "a", baseAmount: 10_000 }, { id: "b", baseAmount: 5_000 }]);
    expect(result.top5Share).toBe(1);
    expect(result.topTransactionIds).toEqual(["a", "b"]);
  });
});
