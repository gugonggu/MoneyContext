import { describe, expect, it } from "vitest";

import { parseDefaultTransactionDate } from "@/domain/transactions/default-date";

describe("parseDefaultTransactionDate", () => {
  it("accepts an actual ISO calendar date", () => {
    expect(parseDefaultTransactionDate("2026-08-05")).toBe("2026-08-05");
  });

  it("rejects impossible and malformed dates", () => {
    expect(parseDefaultTransactionDate("2026-02-31")).toBeUndefined();
    expect(parseDefaultTransactionDate("2026-13-05")).toBeUndefined();
    expect(parseDefaultTransactionDate("2026-8-5")).toBeUndefined();
  });
});
