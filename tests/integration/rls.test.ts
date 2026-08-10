import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

type TestUser = Readonly<{
  id: string;
  email: string;
  password: string;
}>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();
const { url, anonKey } = getSupabasePublicConfig();
let userA: TestUser;
let userB: TestUser;
let userAClient: ReturnType<typeof createClient>;
let transactionBId: string;
let accountBId: string;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-rls-${label}-${testRunId}@example.test`;
  const password = `RlsTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Unable to create RLS test user: ${error?.message ?? "unknown error"}`);
  }

  return { id: data.user.id, email, password };
}

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");

  const { error: profileError } = await admin.from("profiles").insert([
    { id: userA.id, display_name: "RLS User A", salary_cycle_day: 1 },
    { id: userB.id, display_name: "RLS User B", salary_cycle_day: 1 },
  ]);
  if (profileError) throw new Error(profileError.message);

  const { data: accountB, error: accountError } = await admin
    .from("accounts")
    .insert({ user_id: userB.id, name: "User B bank", type: "BANK" })
    .select("id")
    .single();
  if (accountError || !accountB) throw new Error(accountError?.message ?? "Missing account");
  accountBId = accountB.id;

  const { data: transactionB, error: transactionError } = await admin
    .from("transactions")
    .insert({
      user_id: userB.id,
      type: "EXPENSE",
      status: "CONFIRMED",
      transaction_at: "2026-08-10T00:00:00+09:00",
      amount: 1000,
      currency: "KRW",
      base_amount: 1000,
      base_currency: "KRW",
      account_id: accountBId,
    })
    .select("id")
    .single();
  if (transactionError || !transactionB) throw new Error(transactionError?.message ?? "Missing transaction");
  transactionBId = transactionB.id;

  userAClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await userAClient.auth.signInWithPassword({
    email: userA.email,
    password: userA.password,
  });
  if (signInError) throw new Error(signInError.message);
});

afterAll(async () => {
  await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
  await Promise.all([userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)));
});

describe("RLS user isolation", () => {
  it("does not return another user's transaction", async () => {
    const { data, error } = await userAClient.from("transactions").select("id").eq("id", transactionBId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rejects a transaction linked to another user's account", async () => {
    const { error } = await userAClient.from("transactions").insert({
      user_id: userA.id,
      type: "EXPENSE",
      status: "CONFIRMED",
      transaction_at: "2026-08-10T00:00:00+09:00",
      amount: 1000,
      currency: "KRW",
      base_amount: 1000,
      base_currency: "KRW",
      account_id: accountBId,
    });

    expect(error).not.toBeNull();
  });

  it("does not allow a user to deactivate another user's account", async () => {
    const { data, error } = await userAClient
      .from("accounts")
      .update({ is_active: false })
      .eq("id", accountBId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
