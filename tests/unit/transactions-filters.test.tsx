import { describe, expect, it } from "vitest";

import { describeActiveFilters } from "@/domain/transactions/filter-summary";

describe("describeActiveFilters", () => {
  it("returns nothing when no filter is applied", () => {
    expect(describeActiveFilters({}, { accounts: [], categories: [], tags: [] })).toEqual([]);
  });

  it("describes a date range", () => {
    expect(
      describeActiveFilters({ from: "2026-08-01", to: "2026-08-31" }, { accounts: [], categories: [], tags: [] }),
    ).toEqual([{ key: "period", label: "2026-08-01 ~ 2026-08-31" }]);
  });

  it("describes an open-ended date range", () => {
    expect(describeActiveFilters({ from: "2026-08-01" }, { accounts: [], categories: [], tags: [] })).toEqual([
      { key: "period", label: "2026-08-01 이후" },
    ]);
  });

  it("resolves an account id to its name", () => {
    expect(
      describeActiveFilters({ accountId: "a1" }, { accounts: [{ id: "a1", name: "국민카드" }], categories: [], tags: [] }),
    ).toEqual([{ key: "accountId", label: "국민카드" }]);
  });

  it("falls back gracefully when the id is unknown", () => {
    expect(describeActiveFilters({ categoryId: "gone" }, { accounts: [], categories: [], tags: [] })).toEqual([
      { key: "categoryId", label: "카테고리" },
    ]);
  });

  it("describes an amount range", () => {
    expect(
      describeActiveFilters(
        { minAmount: 10_000, maxAmount: 50_000 },
        { accounts: [], categories: [], tags: [] },
      ),
    ).toEqual([{ key: "amount", label: "10,000원 ~ 50,000원" }]);
  });

  it("describes a memo search", () => {
    expect(describeActiveFilters({ memo: "커피" }, { accounts: [], categories: [], tags: [] })).toEqual([
      { key: "memo", label: '메모 "커피"' },
    ]);
  });

  it("describes the transaction type in Korean", () => {
    expect(describeActiveFilters({ type: "EXPENSE" }, { accounts: [], categories: [], tags: [] })).toEqual([
      { key: "type", label: "지출" },
    ]);
  });
});
