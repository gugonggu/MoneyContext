import { describe, expect, it } from "vitest";
import { resolveExpenseNature } from "@/domain/export/expense-nature";

describe("resolveExpenseNature", () => {
  it("사용자가 MANUAL로 지정한 값을 파생값보다 우선한다", () => {
    expect(resolveExpenseNature({
      recurringRuleId: "rule-1",
      expenseNatureUser: "EXCEPTIONAL",
      expenseNatureSource: "MANUAL",
    })).toBe("EXCEPTIONAL");
  });

  it("UNSET이면 반복 거래 규칙 기반 파생값을 사용한다", () => {
    expect(resolveExpenseNature({ recurringRuleId: "rule-1", expenseNatureSource: "UNSET" })).toBe("RECURRING");
  });

  it("UNSET이면 예정 거래 기반 파생값을 사용한다", () => {
    expect(resolveExpenseNature({ plannedTransactionId: "planned-1", expenseNatureSource: "UNSET" })).toBe("ONE_TIME");
  });

  it("소스 정보가 아예 없으면 UNSET과 동일하게 파생 로직을 사용한다", () => {
    expect(resolveExpenseNature({})).toBe("UNKNOWN");
  });

  it("MANUAL이지만 값이 없으면(비정상 데이터) 파생 로직으로 안전하게 대체한다", () => {
    expect(resolveExpenseNature({ expenseNatureSource: "MANUAL", recurringRuleId: "rule-1" })).toBe("RECURRING");
  });
});
