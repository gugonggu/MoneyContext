import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listStatisticsTransactions } from "@/server/statistics/repository";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();

let user: TestUser;

async function createTestUser(): Promise<TestUser> {
  const email = `money-context-statistics-${testRunId}@example.test`;
  const password = `StatisticsTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create test user");
  return { id: data.user.id, email, password };
}

beforeAll(async () => {
  user = await createTestUser();
  const { error } = await admin.from("profiles").insert({ id: user.id, display_name: "Statistics User", salary_cycle_day: 1, base_currency: "KRW" });
  if (error) throw new Error(error.message);
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
});

describe("statistics repository", () => {
  it("reads confirmed income/expense transactions without a PostgREST embed-ambiguity error", async () => {
    // transactions has three FKs to accounts (account_id/from_account_id/to_account_id);
    // an unqualified `accounts(name)` embed is ambiguous and PostgREST rejects the whole
    // query with "more than one relationship was found for 'transactions' and 'accounts'" -
    // this seeds enough of a real account/transaction graph to exercise that embed for real.
    const { data: account, error: accountError } = await admin.from("accounts").insert({ user_id: user.id, name: "statistics test account", type: "CASH" }).select("id").single();
    if (accountError || !account) throw new Error(accountError?.message ?? "Missing account");

    const { error: transactionError } = await admin.from("transactions").insert({
      user_id: user.id,
      type: "EXPENSE",
      status: "CONFIRMED",
      transaction_at: "2026-08-10T00:00:00+09:00",
      amount: 15000,
      currency: "KRW",
      base_amount: 15000,
      base_currency: "KRW",
      account_id: account.id,
    });
    if (transactionError) throw new Error(transactionError.message);

    const transactions = await listStatisticsTransactions(admin, user.id);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ type: "EXPENSE", baseAmount: 15000, accountName: "statistics test account" });
  });
});
