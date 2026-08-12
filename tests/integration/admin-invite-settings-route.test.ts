import { describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  currentProfile: { id: "admin-1", role: "ADMIN" as const },
  getInviteSettingsStatus: vi.fn(async () => ({ signupEnabled: true, hasInviteCode: true })),
  rotateInviteCodeForAdmin: vi.fn(async () => ({ inviteCode: "FRESH-CODE" })),
  setSignupEnabledForAdmin: vi.fn(async () => undefined),
}));

vi.mock("@/server/auth/require-profile", () => ({
  requireAdminProfile: async () => {
    if (routeState.currentProfile.role !== "ADMIN") throw new Error("not admin");
    return routeState.currentProfile;
  },
}));
vi.mock("@/server/admin/invite-settings", () => ({
  getInviteSettingsStatus: routeState.getInviteSettingsStatus,
  rotateInviteCodeForAdmin: routeState.rotateInviteCodeForAdmin,
  setSignupEnabledForAdmin: routeState.setSignupEnabledForAdmin,
}));

import { GET, PATCH } from "@/app/api/admin/invite-settings/route";
import { POST as rotate } from "@/app/api/admin/invite-settings/rotate/route";

describe("admin invite settings routes", () => {
  it("GET returns the current status without the invite code hash", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ signupEnabled: true, hasInviteCode: true });
  });

  it("PATCH toggles signup and returns 204", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/invite-settings", { method: "PATCH", body: JSON.stringify({ signupEnabled: false }) }));
    expect(response.status).toBe(204);
    expect(routeState.setSignupEnabledForAdmin).toHaveBeenCalledWith(false);
  });

  it("PATCH rejects a non-boolean signupEnabled with 400 and does not call the service", async () => {
    routeState.setSignupEnabledForAdmin.mockClear();
    const response = await PATCH(new Request("http://localhost/api/admin/invite-settings", { method: "PATCH", body: JSON.stringify({ signupEnabled: "yes" }) }));
    expect(response.status).toBe(400);
    expect(routeState.setSignupEnabledForAdmin).not.toHaveBeenCalled();
  });

  it("POST rotate returns the plaintext invite code exactly once in the body", async () => {
    const response = await rotate();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ inviteCode: "FRESH-CODE" });
  });
});
