import { beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  currentProfile: { id: "session-user-id" },
  requireCurrentProfile: vi.fn(),
  restoreBackupForCurrentUser: vi.fn(),
}));

vi.mock("@/server/auth/require-profile", () => ({
  requireCurrentProfile: routeState.requireCurrentProfile,
}));
vi.mock("@/server/backup", () => ({
  restoreBackupForCurrentUser: routeState.restoreBackupForCurrentUser,
}));

import { POST } from "@/app/api/backup/restore/route";

describe("POST /api/backup/restore", () => {
  beforeEach(() => {
    routeState.currentProfile = { id: "session-user-id" };
    routeState.requireCurrentProfile.mockReset();
    routeState.requireCurrentProfile.mockResolvedValue(routeState.currentProfile);
    routeState.restoreBackupForCurrentUser.mockReset();
    routeState.restoreBackupForCurrentUser.mockResolvedValue(undefined);
  });

  it("uses only the authenticated session profile id when a payload supplies another user_id", async () => {
    const payload = {
      user_id: "attacker-controlled-user-id",
      profile: { id: "another-attacker-controlled-id" },
      accounts: [],
    };

    const response = await POST(new Request("https://money-context.test/api/backup/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(204);
    expect(routeState.requireCurrentProfile).toHaveBeenCalledTimes(1);
    expect(routeState.restoreBackupForCurrentUser).toHaveBeenCalledWith("session-user-id", payload);
  });
});
