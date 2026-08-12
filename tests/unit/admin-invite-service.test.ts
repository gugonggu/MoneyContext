import { describe, expect, it, vi } from "vitest";

import { createInviteSettingsService } from "@/server/admin/invite-settings/service";
import { NoInviteCodeError } from "@/server/admin/invite-settings/errors";
import { hashInviteCode } from "@/server/auth/invite-hash";
import type { InviteSettingsRepository } from "@/server/admin/invite-settings/service";

function fakeRepository(overrides: Partial<InviteSettingsRepository> = {}): InviteSettingsRepository {
  return {
    getStatus: vi.fn(async () => null),
    rotateInviteCode: vi.fn(async () => undefined),
    setSignupEnabled: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("createInviteSettingsService", () => {
  it("reports hasInviteCode false when no settings row exists", async () => {
    const service = createInviteSettingsService(fakeRepository({ getStatus: vi.fn(async () => null) }), { pepper: "pepper" });
    await expect(service.getStatus()).resolves.toEqual({ signupEnabled: false, hasInviteCode: false });
  });

  it("reports hasInviteCode true once a settings row exists", async () => {
    const service = createInviteSettingsService(fakeRepository({ getStatus: vi.fn(async () => ({ signupEnabled: true })) }), { pepper: "pepper" });
    await expect(service.getStatus()).resolves.toEqual({ signupEnabled: true, hasInviteCode: true });
  });

  it("rotate generates a fresh code, hashes it with the pepper, and returns the plaintext once", async () => {
    const rotateInviteCode = vi.fn(async () => undefined);
    const service = createInviteSettingsService(fakeRepository({ rotateInviteCode }), {
      pepper: "pepper",
      generateCode: () => "FRESH-CODE-123",
    });

    const result = await service.rotate();

    expect(result).toEqual({ inviteCode: "FRESH-CODE-123" });
    expect(rotateInviteCode).toHaveBeenCalledWith(hashInviteCode("FRESH-CODE-123", "pepper"));
  });

  it("setSignupEnabled delegates to the repository", async () => {
    const setSignupEnabled = vi.fn(async () => undefined);
    const service = createInviteSettingsService(fakeRepository({ getStatus: vi.fn(async () => ({ signupEnabled: false })), setSignupEnabled }), { pepper: "pepper" });

    await service.setSignupEnabled(true);

    expect(setSignupEnabled).toHaveBeenCalledWith(true);
  });

  it("setSignupEnabled throws NoInviteCodeError when no invite code has ever been generated", async () => {
    const service = createInviteSettingsService(fakeRepository({ getStatus: vi.fn(async () => null) }), { pepper: "pepper" });

    await expect(service.setSignupEnabled(true)).rejects.toBeInstanceOf(NoInviteCodeError);
  });
});
