import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createInstallmentSchedule } from "@/domain/cards/installments";

type TestUser = Readonly<{
  id: string;
  email: string;
  password: string;
}>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabaseCredentials = Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey);
const describeWithSupabase = hasSupabaseCredentials ? describe : describe.skip;
const testRunId = randomUUID();

let admin: SupabaseClient;
let userA: TestUser;
let userB: TestUser;
let userAClient: SupabaseClient;
let userBClient: SupabaseClient;
let cardAccountId: string;
let bankAccountId: string;
let categoryId: string;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-installment-${label}-${testRunId}@example.test`;
  const password = `InstallmentTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });

  if (error || !data.user) {
    throw new Error(`Unable to create installment test user: ${error?.message ?? "unknown error"}`);
  }

  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: `money-context-installment-${user.id}`,
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

function scheduleRows() {
  return createInstallmentSchedule({ totalAmount: 1_000, installmentCount: 3, firstPaymentDate: "2026-01-31" }).map((row) => ({
    sequence: row.sequence,
    scheduled_date: row.scheduledDate,
    principal_amount: row.principalAmount,
    fee_amount: row.feeAmount,
  }));
}

async function createPurchase(client: SupabaseClient, memo: string, scheduleOverride?: unknown[]) {
  return client.rpc("create_installment_purchase", {
    input_purchase: {
      account_id: cardAccountId,
      category_id: categoryId,
      transaction_at: "2026-01-31T00:00:00+09:00",
      amount: 1_000,
      memo,
      installment_count: 3,
      interest_type: "INTEREST_FREE",
      start_month: "2026-01-01",
    },
    payment_schedule: scheduleOverride ?? scheduleRows(),
  });
}

async function paymentRows(client: SupabaseClient, planId: string) {
  const { data, error } = await client
    .from("installment_payments")
    .select("id,sequence,scheduled_date,principal_amount,fee_amount,status,settlement_transfer_id")
    .eq("installment_plan_id", planId)
    .order("sequence");
  if (error) throw new Error(error.message);
  return data;
}

async function confirmedExpenseRows(client: SupabaseClient, memo: string) {
  const { data, error } = await client
    .from("transactions")
    .select("id,type,status,account_id")
    .eq("type", "EXPENSE")
    .eq("status", "CONFIRMED")
    .eq("memo", memo);
  if (error) throw new Error(error.message);
  return data;
}

async function transactionRow(client: SupabaseClient, transactionId: string) {
  const { data, error } = await client
    .from("transactions")
    .select("id,type,status,from_account_id,to_account_id,amount")
    .eq("id", transactionId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function paymentRow(client: SupabaseClient, paymentId: string) {
  const { data, error } = await client
    .from("installment_payments")
    .select("id,status,settlement_transfer_id")
    .eq("id", paymentId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

describeWithSupabase("TC-INS installment persistence", () => {
  beforeAll(async () => {
    admin = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `money-context-installment-admin-${testRunId}`,
      },
    });
    userA = await createTestUser("a");
    userB = await createTestUser("b");

    const { error: profileError } = await admin.from("profiles").insert([
      { id: userA.id, display_name: "Installment User A", salary_cycle_day: 1 },
      { id: userB.id, display_name: "Installment User B", salary_cycle_day: 1 },
    ]);
    if (profileError) throw new Error(profileError.message);

    const { data: bankAccount, error: bankError } = await admin
      .from("accounts")
      .insert({ user_id: userA.id, name: "Installment bank", type: "BANK" })
      .select("id")
      .single();
    if (bankError || !bankAccount) throw new Error(bankError?.message ?? "Missing bank account");
    bankAccountId = bankAccount.id;

    const { data: cardAccount, error: cardError } = await admin
      .from("accounts")
      .insert({ user_id: userA.id, name: "Installment card", type: "CREDIT_CARD" })
      .select("id")
      .single();
    if (cardError || !cardAccount) throw new Error(cardError?.message ?? "Missing card account");
    cardAccountId = cardAccount.id;

    const { data: category, error: categoryError } = await admin
      .from("categories")
      .insert({ user_id: userA.id, name: `Installment-${testRunId}`, kind: "EXPENSE" })
      .select("id")
      .single();
    if (categoryError || !category) throw new Error(categoryError?.message ?? "Missing category");
    categoryId = category.id;

    userAClient = await authenticatedClient(userA);
    userBClient = await authenticatedClient(userB);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
    await Promise.all(
      [userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)),
    );
  });

  it("rejects a schedule whose principal does not sum to the purchase amount", async () => {
    const memo = `invalid-${testRunId}`;
    const brokenSchedule = scheduleRows();
    brokenSchedule[0].principal_amount = brokenSchedule[0].principal_amount + 1;

    const { error } = await createPurchase(userAClient, memo, brokenSchedule);
    expect(error).not.toBeNull();

    await expect(confirmedExpenseRows(userAClient, memo)).resolves.toEqual([]);
  });

  it("atomically persists the purchase, plan, and payment schedule", async () => {
    const memo = `purchase-${testRunId}`;
    const { data: planId, error } = await createPurchase(userAClient, memo);
    if (error) throw new Error(error.message);

    const expenses = await confirmedExpenseRows(userAClient, memo);
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({ type: "EXPENSE", status: "CONFIRMED", account_id: cardAccountId });

    const payments = await paymentRows(userAClient, planId as string);
    expect(payments).toHaveLength(3);
    expect(payments.map((row) => row.status)).toEqual(["SCHEDULED", "SCHEDULED", "SCHEDULED"]);

    await expect(paymentRows(userBClient, planId as string)).resolves.toEqual([]);

    const firstPaymentId = payments[0].id as string;
    const { data: transferId, error: settleError } = await userAClient.rpc("create_installment_settlement", {
      input_payment_id: firstPaymentId,
      input_payment_account_id: bankAccountId,
      input_transaction_at: "2026-01-31T00:00:00+09:00",
    });
    if (settleError) throw new Error(settleError.message);

    const transfer = await transactionRow(userAClient, transferId as string);
    expect(transfer).toMatchObject({
      type: "TRANSFER",
      status: "CONFIRMED",
      from_account_id: bankAccountId,
      to_account_id: cardAccountId,
      amount: 334,
    });

    const settledPayment = await paymentRow(userAClient, firstPaymentId);
    expect(settledPayment).toMatchObject({ status: "PAID", settlement_transfer_id: transferId });

    const { error: secondSettlementError } = await userAClient.rpc("create_installment_settlement", {
      input_payment_id: firstPaymentId,
      input_payment_account_id: bankAccountId,
      input_transaction_at: "2026-01-31T00:00:00+09:00",
    });
    expect(secondSettlementError).not.toBeNull();
  });
});
