import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();
const { url, anonKey } = getSupabasePublicConfig();

let adminUser: TestUser;
let regularUser: TestUser;

async function createTestUser(label: "admin" | "user", role: "ADMIN" | "USER"): Promise<TestUser> {
  const email = `money-context-admin-invite-${label}-${testRunId}@example.test`;
  const password = `AdminInviteTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create test user");
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, display_name: label, role, salary_cycle_day: 1, base_currency: "KRW" });
  if (profileError) throw new Error(profileError.message);
  return { id: data.user.id, email, password };
}

beforeAll(async () => {
  [adminUser, regularUser] = await Promise.all([createTestUser("admin", "ADMIN"), createTestUser("user", "USER")]);
});

afterAll(async () => {
  await Promise.all([admin.auth.admin.deleteUser(adminUser.id), admin.auth.admin.deleteUser(regularUser.id)]);
});

describe("admin invite settings authorization", () => {
  it("seeds an ADMIN profile and a USER profile with the roles requireAdminProfile checks", async () => {
    const { data: adminProfile } = await admin.from("profiles").select("role").eq("id", adminUser.id).single();
    const { data: userProfile } = await admin.from("profiles").select("role").eq("id", regularUser.id).single();
    expect(adminProfile?.role).toBe("ADMIN");
    expect(userProfile?.role).toBe("USER");
  });
});
