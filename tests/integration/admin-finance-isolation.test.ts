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
let adminClient: SupabaseClient;
let regularUserAccountId: string;

async function createTestUser(label: "admin" | "user", role: "ADMIN" | "USER"): Promise<TestUser> {
  const email = `money-context-admin-isolation-${label}-${testRunId}@example.test`;
  const password = `AdminIsolationTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create test user");
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, display_name: label, role, salary_cycle_day: 1, base_currency: "KRW" });
  if (profileError) throw new Error(profileError.message);
  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: `money-context-admin-isolation-${user.id}` },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

beforeAll(async () => {
  [adminUser, regularUser] = await Promise.all([createTestUser("admin", "ADMIN"), createTestUser("user", "USER")]);
  adminClient = await authenticatedClient(adminUser);
  const regularUserClient = await authenticatedClient(regularUser);
  const { data, error } = await regularUserClient
    .from("accounts")
    .insert({ user_id: regularUser.id, name: "admin isolation regular account", type: "CASH" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Unable to seed regular user account");
  regularUserAccountId = data.id;
});

afterAll(async () => {
  await Promise.all([admin.auth.admin.deleteUser(adminUser.id), admin.auth.admin.deleteUser(regularUser.id)]);
});

describe("ADMIN role has no special finance data access", () => {
  it("cannot read another user's accounts through the authenticated client", async () => {
    const { data, error } = await adminClient.from("accounts").select("id").eq("id", regularUserAccountId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot update another user's account through the authenticated client", async () => {
    const { data, error } = await adminClient.from("accounts").update({ name: "hijacked" }).eq("id", regularUserAccountId).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { data: unchanged } = await admin.from("accounts").select("name").eq("id", regularUserAccountId).maybeSingle();
    expect(unchanged?.name).toBe("admin isolation regular account");
  });

  it("cannot delete another user's account through the authenticated client", async () => {
    const { error } = await adminClient.from("accounts").delete().eq("id", regularUserAccountId);
    expect(error).toBeNull();
    const { data: stillThere } = await admin.from("accounts").select("id").eq("id", regularUserAccountId).maybeSingle();
    expect(stillThere?.id).toBe(regularUserAccountId);
  });
});
