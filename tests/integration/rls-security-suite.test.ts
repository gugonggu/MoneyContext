import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();
const { url, anonKey } = getSupabasePublicConfig();

let userA: TestUser;
let userB: TestUser;
let userAClient: SupabaseClient;
let userBClient: SupabaseClient;
let accountAId: string;
let accountBId: string;
let transactionBId: string;
let tagBId: string;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-security-suite-${label}-${testRunId}@example.test`;
  const password = `SecuritySuiteTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create test user");
  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false, storageKey: `money-context-security-suite-${user.id}` } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

beforeAll(async () => {
  [userA, userB] = await Promise.all([createTestUser("a"), createTestUser("b")]);
  const { error: profileError } = await admin.from("profiles").insert([
    { id: userA.id, display_name: "Security Suite User A", salary_cycle_day: 1, base_currency: "KRW" },
    { id: userB.id, display_name: "Security Suite User B", salary_cycle_day: 1, base_currency: "KRW" },
  ]);
  if (profileError) throw new Error(profileError.message);

  [userAClient, userBClient] = await Promise.all([authenticatedClient(userA), authenticatedClient(userB)]);

  const { data: accountA, error: accountAError } = await userAClient.from("accounts").insert({ user_id: userA.id, name: "security suite A account", type: "CASH" }).select("id").single();
  if (accountAError || !accountA) throw new Error(accountAError?.message ?? "Missing account A");
  accountAId = accountA.id;

  const { data: accountB, error: accountBError } = await userBClient.from("accounts").insert({ user_id: userB.id, name: "security suite B account", type: "CASH" }).select("id").single();
  if (accountBError || !accountB) throw new Error(accountBError?.message ?? "Missing account B");
  accountBId = accountB.id;

  const { data: transactionB, error: transactionBError } = await userBClient
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
  if (transactionBError || !transactionB) throw new Error(transactionBError?.message ?? "Missing transaction B");
  transactionBId = transactionB.id;

  const { data: tagB, error: tagBError } = await userBClient.from("tags").insert({ user_id: userB.id, name: "security suite B tag" }).select("id").single();
  if (tagBError || !tagB) throw new Error(tagBError?.message ?? "Missing tag B");
  tagBId = tagB.id;
});

afterAll(async () => {
  await Promise.all([admin.auth.admin.deleteUser(userA.id), admin.auth.admin.deleteUser(userB.id)]);
});

describe("security regression: profiles self-only isolation", () => {
  it("does not return another user's profile", async () => {
    const { data, error } = await userAClient.from("profiles").select("id").eq("id", userB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not allow updating another user's profile", async () => {
    const { data, error } = await userAClient.from("profiles").update({ display_name: "hijacked" }).eq("id", userB.id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: unchanged } = await admin.from("profiles").select("display_name").eq("id", userB.id).single();
    expect(unchanged?.display_name).toBe("Security Suite User B");
  });
});

describe("security regression: transaction_tags relationship-scoped isolation", () => {
  it("does not return a tag assignment on another user's transaction", async () => {
    const { error: assignError } = await admin.from("transaction_tags").insert({ transaction_id: transactionBId, tag_id: tagBId });
    if (assignError) throw new Error(assignError.message);

    const { data, error } = await userAClient.from("transaction_tags").select("transaction_id").eq("transaction_id", transactionBId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rejects tagging another user's transaction even with the caller's own tag", async () => {
    const { data: ownTag, error: ownTagError } = await userAClient.from("tags").insert({ user_id: userA.id, name: "security suite A tag" }).select("id").single();
    if (ownTagError || !ownTag) throw new Error(ownTagError?.message ?? "Missing own tag");

    const { error } = await userAClient.from("transaction_tags").insert({ transaction_id: transactionBId, tag_id: ownTag.id });
    expect(error).not.toBeNull();
  });

  it("rejects tagging the caller's own transaction with another user's tag", async () => {
    const { data: ownTransaction, error: ownTransactionError } = await userAClient
      .from("transactions")
      .insert({
        user_id: userA.id,
        type: "EXPENSE",
        status: "CONFIRMED",
        transaction_at: "2026-08-10T00:00:00+09:00",
        amount: 500,
        currency: "KRW",
        base_amount: 500,
        base_currency: "KRW",
        account_id: accountAId,
      })
      .select("id")
      .single();
    if (ownTransactionError || !ownTransaction) throw new Error(ownTransactionError?.message ?? "Missing own transaction");

    const { error } = await userAClient.from("transaction_tags").insert({ transaction_id: ownTransaction.id, tag_id: tagBId });
    expect(error).not.toBeNull();
  });
});

describe("security regression: modified-UUID (IDOR) requests against foreign-owned references", () => {
  it("rejects creating a recurring transaction rule against another user's account", async () => {
    const { error } = await userAClient.from("recurring_transactions").insert({
      user_id: userA.id,
      type: "EXPENSE",
      amount: 1000,
      currency: "KRW",
      account_id: accountBId,
      frequency: "MONTHLY",
      interval_count: 1,
      day_of_month: 1,
      start_date: "2026-08-01",
      next_run_date: "2026-09-01",
      confirmation_mode: "AUTO_CONFIRM",
    });
    expect(error).not.toBeNull();
  });

  it("rejects creating an installment plan against another user's transaction", async () => {
    const { error } = await userAClient.from("installment_plans").insert({
      user_id: userA.id,
      transaction_id: transactionBId,
      total_amount: 1000,
      installment_count: 2,
      interest_type: "NONE",
      start_month: "2026-08-01",
    });
    expect(error).not.toBeNull();
  });
});
