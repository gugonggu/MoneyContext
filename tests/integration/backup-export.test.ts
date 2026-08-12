import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createBackupRepository } from "@/server/backup/repository";
import { createBackupService } from "@/server/backup/service";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const routeState = vi.hoisted(() => ({
  currentProfile: { id: "user-a" },
  generateBackupForCurrentUser: vi.fn(async () => ({ metadata: { schema: "money-context-backup" } })),
}));

vi.mock("@/server/auth/require-profile", () => ({
  requireCurrentProfile: async () => routeState.currentProfile,
}));
vi.mock("@/server/backup", () => ({
  generateBackupForCurrentUser: routeState.generateBackupForCurrentUser,
}));

import { GET as getBackup } from "@/app/api/backup/route";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();
const { url, anonKey } = getSupabasePublicConfig();

let userA: TestUser;
let userB: TestUser;
let userAClient: SupabaseClient;
let userBClient: SupabaseClient;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-backup-${label}-${testRunId}@example.test`;
  const password = `BackupTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create backup test user");
  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false, storageKey: `money-context-backup-${user.id}` } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

describe("full backup export", () => {
  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("a"), createTestUser("b")]);
    const { error } = await admin.from("profiles").insert([
      { id: userA.id, display_name: "Backup User A", salary_cycle_day: 1, base_currency: "KRW" },
      { id: userB.id, display_name: "Backup User B", salary_cycle_day: 1, base_currency: "KRW" },
    ]);
    if (error) throw new Error(error.message);
    [userAClient, userBClient] = await Promise.all([authenticatedClient(userA), authenticatedClient(userB)]);
  });

  afterAll(async () => {
    await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
    await Promise.all([userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)));
  });

  it("exports only user A's complete financial graph and omits sensitive profile fields", async () => {
    const [{ data: accounts, error: accountError }, { data: category, error: categoryError }, { data: tag, error: tagError }] = await Promise.all([
      userAClient.from("accounts").insert({ user_id: userA.id, name: "A Bank", type: "BANK" }).select("id").single(),
      userAClient.from("categories").insert({ user_id: userA.id, name: "A Food", kind: "EXPENSE" }).select("id").single(),
      userAClient.from("tags").insert({ user_id: userA.id, name: "A Tag" }).select("id").single(),
    ]);
    if (accountError || categoryError || tagError || !accounts || !category || !tag) throw new Error("Unable to create backup graph roots");

    const { data: transaction, error: transactionError } = await userAClient.from("transactions").insert({
      user_id: userA.id, type: "EXPENSE", status: "CONFIRMED", transaction_at: "2026-08-12T12:00:00+09:00", amount: 1000, currency: "KRW", base_amount: 1000, base_currency: "KRW", account_id: accounts.id, category_id: category.id,
    }).select("id").single();
    if (transactionError || !transaction) throw new Error(transactionError?.message ?? "Unable to create backup transaction");
    const { error: transactionTagError } = await userAClient.from("transaction_tags").insert({ transaction_id: transaction.id, tag_id: tag.id });
    if (transactionTagError) throw new Error(transactionTagError.message);

    const { data: cardAccount, error: cardAccountError } = await userAClient.from("accounts").insert({ user_id: userA.id, name: "A Card", type: "CREDIT_CARD" }).select("id").single();
    if (cardAccountError || !cardAccount) throw new Error(cardAccountError?.message ?? "Unable to create backup card account");
    const { data: cardSettings, error: cardSettingsError } = await userAClient.from("credit_card_settings").insert({
      user_id: userA.id, account_id: cardAccount.id, payment_account_id: accounts.id, payment_day: 25, credit_limit: 1_000_000, billing_cycle_rule: {},
    }).select("id").single();
    if (cardSettingsError || !cardSettings) throw new Error(cardSettingsError?.message ?? "Unable to create backup card settings");
    const [{ data: recurring, error: recurringError }, { data: planned, error: plannedError }, { data: monthlyBudget, error: monthlyBudgetError }, { data: categoryBudget, error: categoryBudgetError }, { data: savingsGoal, error: savingsGoalError }] = await Promise.all([
      userAClient.from("recurring_transactions").insert({ user_id: userA.id, type: "EXPENSE", amount: 300, currency: "KRW", account_id: accounts.id, category_id: category.id, frequency: "MONTHLY", interval_count: 1, start_date: "2026-08-01", next_run_date: "2026-09-01", confirmation_mode: "AUTO_CONFIRM" }).select("id").single(),
      userAClient.from("planned_transactions").insert({ user_id: userA.id, type: "EXPENSE", status: "PLANNED", scheduled_date: "2026-09-01", amount: 400, currency: "KRW", base_amount: 400, base_currency: "KRW", account_id: accounts.id, category_id: category.id }).select("id").single(),
      userAClient.from("monthly_budgets").insert({ user_id: userA.id, year: 2026, month: 8, total_budget: 5000 }).select("id").single(),
      userAClient.from("category_budgets").insert({ user_id: userA.id, year: 2026, month: 8, category_id: category.id, base_budget: 3000, rollover_enabled: true, rollover_amount: 100 }).select("id").single(),
      userAClient.from("savings_goals").insert({ user_id: userA.id, name: "A Goal", target_amount: 10_000, target_date: "2026-12-31", monthly_contribution_plan: 1000 }).select("id").single(),
    ]);
    if (recurringError || plannedError || monthlyBudgetError || categoryBudgetError || savingsGoalError || !recurring || !planned || !monthlyBudget || !categoryBudget || !savingsGoal) throw new Error("Unable to create backup financial collections");
    const [{ data: installmentPlan, error: installmentPlanError }, { data: contribution, error: contributionError }] = await Promise.all([
      userAClient.from("installment_plans").insert({ user_id: userA.id, transaction_id: transaction.id, total_amount: 1000, installment_count: 2, interest_type: "INTEREST_FREE", start_month: "2026-08-01" }).select("id").single(),
      userAClient.from("savings_contributions").insert({ user_id: userA.id, goal_id: savingsGoal.id, amount: 1000, contribution_date: "2026-08-12" }).select("id").single(),
    ]);
    if (installmentPlanError || contributionError || !installmentPlan || !contribution) {
      throw new Error(`Unable to create backup dependent financial collections: ${installmentPlanError?.message ?? contributionError?.message ?? "missing row"}`);
    }
    const { data: installmentPayment, error: installmentPaymentError } = await userAClient.from("installment_payments").insert({
      user_id: userA.id, installment_plan_id: installmentPlan.id, sequence: 1, scheduled_date: "2026-09-25", principal_amount: 500, fee_amount: 0,
    }).select("id").single();
    if (installmentPaymentError || !installmentPayment) throw new Error(installmentPaymentError?.message ?? "Unable to create backup installment payment");

    const [{ data: otherAccount, error: otherAccountError }, { data: otherCategory, error: otherCategoryError }] = await Promise.all([
      userBClient.from("accounts").insert({ user_id: userB.id, name: "B Bank", type: "BANK" }).select("id").single(),
      userBClient.from("categories").insert({ user_id: userB.id, name: "B Food", kind: "EXPENSE" }).select("id").single(),
    ]);
    if (otherAccountError || otherCategoryError || !otherAccount || !otherCategory) throw new Error("Unable to create other-user backup data");
    const { error: otherTransactionError } = await userBClient.from("transactions").insert({
      user_id: userB.id, type: "EXPENSE", status: "CONFIRMED", transaction_at: "2026-08-12T12:00:00+09:00", amount: 2000, currency: "KRW", base_amount: 2000, base_currency: "KRW", account_id: otherAccount.id, category_id: otherCategory.id,
    });
    if (otherTransactionError) throw new Error(otherTransactionError.message);

    const extraTags = Array.from({ length: 1000 }, (_, index) => ({
      user_id: userA.id,
      name: `A paged tag ${String(index).padStart(4, "0")}`,
    }));
    const { error: extraTagsError } = await userAClient.from("tags").insert(extraTags);
    if (extraTagsError) throw new Error(extraTagsError.message);

    // The admin client bypasses RLS, so these assertions exercise the repository's
    // explicit current-user predicates rather than relying on database policy alone.
    const backup = await createBackupService(createBackupRepository(admin)).generate(userA.id, new Date("2026-08-12T00:00:00.000Z"));

    expect(backup.profile).toEqual({ id: userA.id, display_name: "Backup User A", base_currency: "KRW", salary_cycle_day: 1, timezone: "Asia/Seoul", onboarding_completed: false });
    expect(backup.profile).not.toHaveProperty("role");
    expect(backup).not.toHaveProperty("notifications");
    expect(backup).not.toHaveProperty("app_settings");
    expect(backup.accounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: accounts.id, name: "A Bank", user_id: userA.id }),
      expect.objectContaining({ id: cardAccount.id, name: "A Card", user_id: userA.id }),
    ]));
    expect(backup.categories).toEqual([expect.objectContaining({ id: category.id, name: "A Food", user_id: userA.id })]);
    expect(backup.tags).toHaveLength(1001);
    expect(backup.tags).toContainEqual(expect.objectContaining({ id: tag.id, name: "A Tag", user_id: userA.id }));
    expect(backup.transactions).toEqual([expect.objectContaining({ id: transaction.id, user_id: userA.id })]);
    expect(backup.transaction_tags).toEqual([{ transaction_id: transaction.id, tag_id: tag.id }]);
    expect(backup.credit_card_settings).toEqual([expect.objectContaining({ id: cardSettings.id, account_id: cardAccount.id, payment_account_id: accounts.id })]);
    expect(backup.recurring_transactions).toEqual([expect.objectContaining({ id: recurring.id, account_id: accounts.id })]);
    expect(backup.planned_transactions).toEqual([expect.objectContaining({ id: planned.id, account_id: accounts.id })]);
    expect(backup.installment_plans).toEqual([expect.objectContaining({ id: installmentPlan.id, transaction_id: transaction.id })]);
    expect(backup.installment_payments).toEqual([expect.objectContaining({ id: installmentPayment.id, installment_plan_id: installmentPlan.id })]);
    expect(backup.monthly_budgets).toEqual([expect.objectContaining({ id: monthlyBudget.id, total_budget: 5000 })]);
    expect(backup.category_budgets).toEqual([expect.objectContaining({ id: categoryBudget.id, category_id: category.id, rollover_amount: 100 })]);
    expect(backup.savings_goals).toEqual([expect.objectContaining({ id: savingsGoal.id, target_amount: 10_000 })]);
    expect(backup.savings_contributions).toEqual([expect.objectContaining({ id: contribution.id, goal_id: savingsGoal.id, transaction_id: null, transfer_id: null })]);
    expect(backup.accounts).not.toContainEqual(expect.objectContaining({ id: otherAccount.id }));
    expect(backup.categories).not.toContainEqual(expect.objectContaining({ id: otherCategory.id }));
    expect(backup.transactions).not.toContainEqual(expect.objectContaining({ user_id: userB.id }));
  });

  it("returns the current user's backup as a JSON attachment", async () => {
    routeState.currentProfile = { id: userA.id };
    routeState.generateBackupForCurrentUser.mockClear();
    routeState.generateBackupForCurrentUser.mockResolvedValue({ metadata: { schema: "money-context-backup" } });

    const response = await getBackup(new Request("https://money-context.test/api/backup"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="money-context-backup.json"');
    expect(await response.text()).toBe('{"metadata":{"schema":"money-context-backup"}}');
    expect(routeState.generateBackupForCurrentUser).toHaveBeenCalledWith(userA.id);
  });
});
