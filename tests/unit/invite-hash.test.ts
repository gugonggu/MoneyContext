import { describe, expect, it } from "vitest";

import { hashInviteCode } from "@/server/auth/invite-hash";

describe("hashInviteCode", () => {
  it("is deterministic for the same code and pepper", () => {
    expect(hashInviteCode("ABC123", "pepper")).toBe(hashInviteCode("ABC123", "pepper"));
  });

  it("changes when the code changes", () => {
    expect(hashInviteCode("ABC123", "pepper")).not.toBe(hashInviteCode("XYZ789", "pepper"));
  });

  it("changes when the pepper changes", () => {
    expect(hashInviteCode("ABC123", "pepper-a")).not.toBe(hashInviteCode("ABC123", "pepper-b"));
  });

  it("returns a 64-character lowercase hex sha256 digest", () => {
    expect(hashInviteCode("ABC123", "pepper")).toMatch(/^[0-9a-f]{64}$/);
  });
});
