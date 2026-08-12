import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BACKUP_COLLECTIONS, type BackupPayload } from "@/domain/backup/schema";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createBackupRepository } from "@/server/backup/repository";
import { createBackupService } from "@/server/backup/service";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

type TestUser = Readonly<{ id: string; email: string; password: string }>;
type SeededGraph = Readonly<{ bankId: string; debitId: string; tagId: string; transactionId: string }>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();
const { url, anonKey } = getSupabasePublicConfig();

let userA: TestUser;
let userB: TestUser;
let userAClient: SupabaseClient;
let userBClient: SupabaseClient;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-restore-${label}-${testRunId}@example.test`;
  const password = `RestoreTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create restore test user");
  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false, storageKey: `money-context-restore-${user.id}` } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

async function insertOne(client: SupabaseClient, table: string, row: Record<string, unknown>): Promise<{ id: string }> {
  const { data, error } = await client.from(table).insert(row).select("id").single();
  if (error || !data) throw new Error(error?.message ?? `Unable to insert ${table}`);
  return data as { id: string };
}

async function seedFinancialGraph(client: SupabaseClient, user: TestUser, label: string): Promise<SeededGraph> {
  const bank = await insertOne(client, "accounts", { user_id: user.id, name: `${label} bank`, type: "BANK" });
  const debit = await insertOne(client, "accounts", { user_id: user.id, name: `${label} debit`, type: "DEBIT", linked_account_id: bank.id });
  const category = await insertOne(client, "categories", { user_id: user.id, name: `${label} food`, kind: "EXPENSE" });
  const tag = await insertOne(client, "tags", { user_id: user.id, name: `${label} tag` });
  const transaction = await insertOne(client, "transactions", {
    user_id: user.id,
    type: "EXPENSE",
    status: "CONFIRMED",
    transaction_at: "2026-08-12T12:00:00+09:00",
    amount: 1000,
    currency: "KRW",
    base_amount: 1000,
    base_currency: "KRW",
    account_id: debit.id,
    category_id: category.id,
  });
  const { error } = await client.from("transaction_tags").insert({ transaction_id: transaction.id, tag_id: tag.id });
  if (error) throw new Error(error.message);
  return { bankId: bank.id, debitId: debit.id, tagId: tag.id, transactionId: transaction.id };
}

async function seedCompleteGraph(client: SupabaseClient, user: TestUser, label: string): Promise<SeededGraph> {
  const graph = await seedFinancialGraph(client, user, label);
  const category = await client.from("categories").select("id").eq("user_id", user.id).eq("name", `${label} food`).single();
  if (category.error || !category.data) throw new Error(category.error?.message ?? "Missing seeded category");
  const card = await insertOne(client, "accounts", { user_id: user.id, name: `${label} card`, type: "CREDIT_CARD" });
  await insertOne(client, "credit_card_settings", {
    user_id: user.id, account_id: card.id, payment_account_id: graph.bankId, payment_day: 25,
    credit_limit: 1_000_000, billing_cycle_rule: {},
  });
  const recurring = await insertOne(client, "recurring_transactions", {
    user_id: user.id, type: "EXPENSE", amount: 300, currency: "KRW", account_id: graph.bankId,
    category_id: category.data.id, frequency: "MONTHLY", interval_count: 1, day_of_month: 1,
    start_date: "2026-08-01", next_run_date: "2026-09-01", confirmation_mode: "AUTO_CONFIRM",
  });
  const planned = await insertOne(client, "planned_transactions", {
    user_id: user.id, type: "EXPENSE", status: "PLANNED", scheduled_date: "2026-09-01", amount: 400,
    currency: "KRW", base_amount: 400, base_currency: "KRW", account_id: graph.bankId, category_id: category.data.id,
  });
  const plannedTransaction = await insertOne(client, "transactions", {
    user_id: user.id, type: "EXPENSE", status: "CONFIRMED", transaction_at: "2026-09-01T00:00:00+09:00",
    amount: 400, currency: "KRW", base_amount: 400, base_currency: "KRW", account_id: graph.bankId,
    category_id: category.data.id, planned_transaction_id: planned.id,
  });
  const { error: plannedError } = await client.from("planned_transactions").update({ status: "CONFIRMED", converted_transaction_id: plannedTransaction.id }).eq("id", planned.id);
  if (plannedError) throw new Error(plannedError.message);
  const cardTransaction = await insertOne(client, "transactions", {
    user_id: user.id, type: "EXPENSE", status: "CONFIRMED", transaction_at: "2026-08-13T12:00:00+09:00",
    amount: 1200, currency: "KRW", base_amount: 1200, base_currency: "KRW", account_id: card.id, category_id: category.data.id,
    recurring_rule_id: recurring.id, recurring_occurrence_date: "2026-08-13",
  });
  const plan = await insertOne(client, "installment_plans", {
    user_id: user.id, transaction_id: cardTransaction.id, total_amount: 1200, installment_count: 2,
    interest_type: "INTEREST_FREE", start_month: "2026-08-01",
  });
  await insertOne(client, "installment_payments", {
    user_id: user.id, installment_plan_id: plan.id, sequence: 1, scheduled_date: "2026-09-25",
    principal_amount: 600, fee_amount: 0, status: "SCHEDULED",
  });
  const periodMonth = label === "rollback" ? 9 : 8;
  await insertOne(client, "monthly_budgets", { user_id: user.id, year: 2026, month: periodMonth, total_budget: 5000 });
  await insertOne(client, "category_budgets", {
    user_id: user.id, year: 2026, month: periodMonth, category_id: category.data.id, base_budget: 3000, rollover_enabled: true, rollover_amount: 100,
  });
  const goal = await insertOne(client, "savings_goals", {
    user_id: user.id, name: `${label} goal`, target_amount: 10_000, target_date: "2026-12-31", monthly_contribution_plan: 1000,
  });
  const transfer = await insertOne(client, "transactions", {
    user_id: user.id, type: "TRANSFER", status: "CONFIRMED", transaction_at: "2026-08-14T12:00:00+09:00",
    amount: 1000, currency: "KRW", base_amount: 1000, base_currency: "KRW", from_account_id: graph.bankId, to_account_id: card.id,
  });
  await insertOne(client, "savings_contributions", {
    user_id: user.id, goal_id: goal.id, amount: 1000, contribution_date: "2026-08-14", transfer_id: transfer.id,
  });
  return graph;
}

async function names(client: SupabaseClient, table: "accounts" | "categories"): Promise<string[]> {
  const { data, error } = await client.from(table).select("name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.name);
}

async function transactionTagPairs(userId: string): Promise<Array<{ transaction_id: string; tag_id: string }>> {
  const { data, error } = await admin.from("transaction_tags").select("transaction_id,tag_id,transactions!inner(user_id)").eq("transactions.user_id", userId).order("transaction_id").order("tag_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map(({ transaction_id, tag_id }) => ({ transaction_id, tag_id }));
}

function expectCollectionCounts(restored: BackupPayload, source: BackupPayload): void {
  for (const collection of BACKUP_COLLECTIONS) {
    expect(restored[collection]).toHaveLength(source[collection].length);
  }
}

beforeAll(async () => {
  [userA, userB] = await Promise.all([createTestUser("a"), createTestUser("b")]);
  const { error } = await admin.from("profiles").insert([
    { id: userA.id, display_name: "Restore User A", salary_cycle_day: 1, base_currency: "KRW" },
    { id: userB.id, display_name: "Restore User B", salary_cycle_day: 1, base_currency: "KRW" },
  ]);
  if (error) throw new Error(error.message);
  [userAClient, userBClient] = await Promise.all([authenticatedClient(userA), authenticatedClient(userB)]);
});

afterAll(async () => {
  await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
  await Promise.all([userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)));
});

describe("full backup restore", () => {
  it("round-trips every v1 collection and restores a DEBIT listed before its BANK", async () => {
    await seedCompleteGraph(userAClient, userA, "round trip");
    const service = createBackupService(createBackupRepository(admin));
    const exportedAt = new Date("2026-08-12T00:00:00.000Z");
    const backup = await service.generate(userA.id, exportedAt);
    const debit = backup.accounts.find((account) => account.name === "round trip debit");
    const bank = backup.accounts.find((account) => account.name === "round trip bank");
    if (!debit || !bank) throw new Error("Missing seeded DEBIT or BANK account");
    const debitFirst = structuredClone(backup);
    debitFirst.accounts = [debit, ...backup.accounts.filter((account) => account.id !== debit.id)];

    await service.restore(userA.id, debitFirst);

    const restored = await service.generate(userA.id, exportedAt);
    expectCollectionCounts(restored, backup);
    const restoredDebit = restored.accounts.find((account) => account.name === "round trip debit");
    const restoredBank = restored.accounts.find((account) => account.name === "round trip bank");
    expect(restoredDebit?.linked_account_id).toBe(restoredBank?.id);
    expect(restored.credit_card_settings).toHaveLength(1);
    expect(restored.transaction_tags).toHaveLength(1);
    expect(restored.recurring_transactions).toHaveLength(1);
    expect(restored.planned_transactions).toHaveLength(1);
    expect(restored.installment_plans).toHaveLength(1);
    expect(restored.installment_payments).toHaveLength(1);
    expect(restored.monthly_budgets).toHaveLength(1);
    expect(restored.category_budgets).toHaveLength(1);
    expect(restored.savings_goals).toHaveLength(1);
    expect(restored.savings_contributions).toHaveLength(1);
  });

  it("rejects direct authenticated RPC attempts without mutating another user's transaction tags", async () => {
    const graphA = await seedFinancialGraph(userAClient, userA, "direct RPC A");
    const injectedTag = await insertOne(userAClient, "tags", { user_id: userA.id, name: "direct RPC injected tag" });
    await insertOne(userBClient, "accounts", { user_id: userB.id, name: "direct RPC B bank", type: "BANK" });
    const service = createBackupService(createBackupRepository(userBClient));
    const backup = await service.generate(userB.id);
    const before = await transactionTagPairs(userA.id);
    backup.transaction_tags = [{ transaction_id: graphA.transactionId, tag_id: injectedTag.id }];

    const { error } = await userBClient.rpc("restore_backup", { target_user_id: userB.id, input_backup: backup });
    expect(error?.code).toBe("42501");

    await expect(transactionTagPairs(userA.id)).resolves.toEqual(before);
  });

  it("ignores payload ownership ids and never replaces another user's graph", async () => {
    await seedFinancialGraph(userAClient, userA, "cross user A");
    await seedFinancialGraph(userBClient, userB, "cross user B");
    const service = createBackupService(createBackupRepository(admin));
    const backup = await service.generate(userA.id);
    const expectedUserAAccounts = await names(userAClient, "accounts");
    const otherUserPayload = structuredClone(backup);
    otherUserPayload.profile.id = userB.id;
    for (const collection of ["accounts", "credit_card_settings", "categories", "tags", "transactions", "recurring_transactions", "planned_transactions", "installment_plans", "installment_payments", "monthly_budgets", "category_budgets", "savings_goals", "savings_contributions"] as const) {
      otherUserPayload[collection].forEach((row) => { row.user_id = userB.id; });
    }

    await service.restore(userA.id, otherUserPayload);

    await expect(names(userBClient, "accounts")).resolves.toContain("cross user B bank");
    await expect(names(userBClient, "categories")).resolves.toContain("cross user B food");
    await expect(names(userAClient, "accounts")).resolves.toEqual(expectedUserAAccounts);
  });

  it("rolls back the complete original graph when a database write fails", async () => {
    await seedCompleteGraph(userAClient, userA, "rollback");
    const service = createBackupService(createBackupRepository(admin));
    const exportedAt = new Date("2026-08-12T00:00:00.000Z");
    const before = await service.generate(userA.id, exportedAt);
    const invalidAtWrite = structuredClone(before);
    const bank = invalidAtWrite.accounts.find((account) => account.type === "BANK");
    const otherAccount = invalidAtWrite.accounts.find((account) => account.id !== bank?.id);
    if (!bank || !otherAccount) throw new Error("Missing accounts for forced write failure");
    bank.linked_account_id = otherAccount.id;

    await expect(service.restore(userA.id, invalidAtWrite)).rejects.toThrow();

    await expect(service.generate(userA.id, exportedAt)).resolves.toEqual(before);
  });
});
