import { describe, expect, it } from "vitest";

import { classifyTransferDirection } from "@/domain/transactions/transfer-direction";

describe("classifyTransferDirection", () => {
  it("classifies a one-sided transfer out (money sent to someone else) as EXPENSE", () => {
    expect(classifyTransferDirection("bank-a", undefined)).toBe("EXPENSE");
  });

  it("classifies a one-sided transfer in (money received from someone else) as INCOME", () => {
    expect(classifyTransferDirection(undefined, "bank-a")).toBe("INCOME");
  });

  it("excludes a transfer between two of the user's own accounts (both sides present)", () => {
    expect(classifyTransferDirection("bank-a", "bank-b")).toBeUndefined();
  });

  it("excludes a transfer with neither side attributable", () => {
    expect(classifyTransferDirection(undefined, undefined)).toBeUndefined();
  });
});
