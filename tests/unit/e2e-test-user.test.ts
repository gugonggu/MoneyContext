import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  deleteUser: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: { deleteUser: supabase.deleteUser },
    },
  }),
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabasePublicConfig: () => ({ url: "https://example.supabase.co", anonKey: "test-anon-key" }),
}));

import { deleteE2EUser, type E2EUser } from "../e2e/support/test-user";

const user: E2EUser = { id: "user-1", email: "user@example.test", password: "test-password" };

describe("deleteE2EUser", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    supabase.deleteUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects when Supabase returns a deletion error", async () => {
    supabase.deleteUser.mockResolvedValue({ data: null, error: { message: "delete returned an error" } });

    await expect(deleteE2EUser(user)).rejects.toThrow("delete returned an error");
  });

  it("rejects when the Supabase deletion request rejects", async () => {
    supabase.deleteUser.mockRejectedValue(new Error("delete request rejected"));

    await expect(deleteE2EUser(user)).rejects.toThrow("delete request rejected");
  });
});
