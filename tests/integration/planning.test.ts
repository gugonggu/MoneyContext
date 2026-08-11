import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

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
let userAClient: SupabaseClient;
let userBClient: SupabaseClient;
let userABankAccountIds: [string, string];
let userBBankAccountIds: [string, string];
let goalIds: [string, string];

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-planning-${label}-${testRunId}@example.test`;
  const password = `PlanningTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Unable to create planning test user: ${error?.message ?? "unknown error"}`);
  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: `money-context-planning-${user.id}`,
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

async function createBankAccounts(userId: string, label: string): Promise<[string, string]> {
  const { data, error } = await admin
    .from("accounts")
    .insert([
      { user_id: userId, name: `${label} source`, type: "BANK" },
      { user_id: userId, name: `${label} destination`, type: "BANK" },
    ])
    .select("id");
  if (error || !data || data.length !== 2) throw new Error(error?.message ?? "Missing bank accounts");
  return [data[0].id, data[1].id];
}

async function createTransfer(
  client: SupabaseClient,
  userId: string,
  accountIds: [string, string],
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await client
    .from("transactions")
    .insert({
      user_id: userId,
      type: "TRANSFER",
      status: "CONFIRMED",
      transaction_at: "2026-08-11T00:00:00+09:00",
      amount: 50_000,
      currency: "KRW",
      base_amount: 50_000,
      base_currency: "KRW",
      from_account_id: accountIds[0],
      to_account_id: accountIds[1],
      ...overrides,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Missing transfer");
  return data.id;
}

async function insertContribution(
  client: SupabaseClient,
  userId: string,
  goalId: string,
  overrides: Record<string, unknown> = {},
) {
  return client
    .from("savings_contributions")
    .insert({
      user_id: userId,
      goal_id: goalId,
      amount: 50_000,
      contribution_date: "2026-08-11",
      ...overrides,
    })
    .select("id,transfer_id,transaction_id")
    .single();
}

describe("TC-PLAN savings contribution transfer integrity", () => {
  beforeAll(async () => {
    userA = await createTestUser("a");
    userB = await createTestUser("b");

    const { error: profileError } = await admin.from("profiles").insert([
      { id: userA.id, display_name: "Planning User A", salary_cycle_day: 1 },
      { id: userB.id, display_name: "Planning User B", salary_cycle_day: 1 },
    ]);
    if (profileError) throw new Error(profileError.message);

    userABankAccountIds = await createBankAccounts(userA.id, "Planning A");
    userBBankAccountIds = await createBankAccounts(userB.id, "Planning B");

    const { data: goals, error: goalError } = await admin
      .from("savings_goals")
      .insert([
        { user_id: userA.id, name: `Planning goal one ${testRunId}`, target_amount: 1_000_000, target_date: "2027-08-11" },
        { user_id: userA.id, name: `Planning goal two ${testRunId}`, target_amount: 2_000_000, target_date: "2027-12-31" },
      ])
      .select("id");
    if (goalError || !goals || goals.length !== 2) throw new Error(goalError?.message ?? "Missing savings goals");
    goalIds = [goals[0].id, goals[1].id];

    userAClient = await authenticatedClient(userA);
    userBClient = await authenticatedClient(userB);
  });

  afterAll(async () => {
    await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
    await Promise.all([userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)));
  });

  it("allows standalone contributions and confirmed owned transfer links", async () => {
    const standalone = await insertContribution(userAClient, userA.id, goalIds[0]);
    if (standalone.error) throw new Error(standalone.error.message);
    expect(standalone.data).toMatchObject({ transfer_id: null, transaction_id: null });

    const transferId = await createTransfer(userAClient, userA.id, userABankAccountIds);
    const linked = await insertContribution(userAClient, userA.id, goalIds[0], { transfer_id: transferId });
    if (linked.error) throw new Error(linked.error.message);
    expect(linked.data).toMatchObject({ transfer_id: transferId, transaction_id: null });
  });

  it("rejects a non-null transaction_id", async () => {
    const transferId = await createTransfer(userAClient, userA.id, userABankAccountIds);
    const { error } = await insertContribution(userAClient, userA.id, goalIds[0], { transaction_id: transferId });
    expect(error).not.toBeNull();
  });

  it("rejects a link to a non-transfer transaction", async () => {
    const { data: expense, error: expenseError } = await userAClient
      .from("transactions")
      .insert({
        user_id: userA.id,
        type: "EXPENSE",
        status: "CONFIRMED",
        transaction_at: "2026-08-11T00:00:00+09:00",
        amount: 50_000,
        currency: "KRW",
        base_amount: 50_000,
        base_currency: "KRW",
        account_id: userABankAccountIds[0],
      })
      .select("id")
      .single();
    if (expenseError || !expense) throw new Error(expenseError?.message ?? "Missing expense");

    const { error } = await insertContribution(userAClient, userA.id, goalIds[0], { transfer_id: expense.id });
    expect(error).not.toBeNull();
  });

  it("rejects a pending transfer link", async () => {
    const transferId = await createTransfer(userAClient, userA.id, userABankAccountIds, { status: "PENDING" });
    const { error } = await insertContribution(userAClient, userA.id, goalIds[0], { transfer_id: transferId });
    expect(error).not.toBeNull();
  });

  it("rejects changing a linked transfer to CANCELLED", async () => {
    const transferId = await createTransfer(userAClient, userA.id, userABankAccountIds);
    const linked = await insertContribution(userAClient, userA.id, goalIds[0], { transfer_id: transferId });
    if (linked.error) throw new Error(linked.error.message);

    const { error: cancelledError } = await userAClient
      .from("transactions")
      .update({ status: "CANCELLED" })
      .eq("id", transferId);
    expect(cancelledError).not.toBeNull();
  });

  it("rejects changing a linked transfer to EXPENSE", async () => {
    const transferId = await createTransfer(userAClient, userA.id, userABankAccountIds);
    const linked = await insertContribution(userAClient, userA.id, goalIds[0], { transfer_id: transferId });
    if (linked.error) throw new Error(linked.error.message);

    const { error: expenseError } = await userAClient
      .from("transactions")
      .update({
        type: "EXPENSE",
        account_id: userABankAccountIds[0],
        from_account_id: null,
        to_account_id: null,
      })
      .eq("id", transferId);
    expect(expenseError).not.toBeNull();
  });

  it("rejects another user's transfer link", async () => {
    const transferId = await createTransfer(userBClient, userB.id, userBBankAccountIds);
    const { error } = await insertContribution(userAClient, userA.id, goalIds[0], { transfer_id: transferId });
    expect(error).not.toBeNull();
  });

  it("rejects reuse of a transfer across savings goals", async () => {
    const transferId = await createTransfer(userAClient, userA.id, userABankAccountIds);
    const first = await insertContribution(userAClient, userA.id, goalIds[0], { transfer_id: transferId });
    if (first.error) throw new Error(first.error.message);

    const second = await insertContribution(userAClient, userA.id, goalIds[1], { transfer_id: transferId });
    expect(second.error).not.toBeNull();
  });
});
