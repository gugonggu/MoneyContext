import { describe, expect, it } from "vitest";

import { isSignupInviteCodeValid } from "@/server/auth/invite";

describe("isSignupInviteCodeValid", () => {
  it("accepts the fixed signup code", () => {
    expect(isSignupInviteCodeValid("moneycontext909")).toBe(true);
  });

  it("trims surrounding whitespace before comparing", () => {
    expect(isSignupInviteCodeValid("  moneycontext909  ")).toBe(true);
  });

  it("rejects any other value, including a near miss", () => {
    expect(isSignupInviteCodeValid("moneycontext910")).toBe(false);
    expect(isSignupInviteCodeValid("")).toBe(false);
    expect(isSignupInviteCodeValid("MONEYCONTEXT909")).toBe(false);
  });
});
