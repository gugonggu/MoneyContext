import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInviteSession, isInviteSessionValid } from "@/server/auth/invite-session";

describe("invite session", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-08-13T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is valid only when the embedded flag is true and the token is unexpired", () => {
    expect(isInviteSessionValid(createInviteSession(true))).toBe(true);
    expect(isInviteSessionValid(createInviteSession(false))).toBe(false);
  });

  it("expires after its ten-minute window", () => {
    const token = createInviteSession(true);

    vi.setSystemTime(new Date("2026-08-13T00:11:00Z"));

    expect(isInviteSessionValid(token)).toBe(false);
  });

  it("rejects a missing, malformed, or tampered token", () => {
    const token = createInviteSession(true);
    const [payload] = token.split(".");

    expect(isInviteSessionValid(undefined)).toBe(false);
    expect(isInviteSessionValid("not-a-token")).toBe(false);
    expect(isInviteSessionValid(`${payload}.wrong-signature`)).toBe(false);
  });
});
