import { describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  currentProfile: { id: "user-a" },
  deleteCurrentUserAccount: vi.fn(async () => undefined),
}));

vi.mock("@/server/auth/require-profile", () => ({
  requireCurrentProfile: async () => routeState.currentProfile,
}));
vi.mock("@/server/account/delete", () => ({
  deleteCurrentUserAccount: routeState.deleteCurrentUserAccount,
}));

import { POST } from "@/app/api/account/delete/route";

describe("account delete route", () => {
  it("deletes the current profile's account and returns 204", async () => {
    const response = await POST();
    expect(response.status).toBe(204);
    expect(routeState.deleteCurrentUserAccount).toHaveBeenCalledWith("user-a");
  });

  it("returns 500 with an error body when deletion fails", async () => {
    routeState.deleteCurrentUserAccount.mockRejectedValueOnce(new Error("boom"));
    const response = await POST();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "boom" });
  });
});
