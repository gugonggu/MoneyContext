import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createPlanningRepository } from "@/server/planning/repository";
import { createPlanningService } from "@/server/planning/service";
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
let activeCategoryId: string;
let inactiveCategoryId: string;

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

describe("TC-PLAN planning persistence", () => {
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

    const { data: categories, error: categoryError } = await admin
      .from("categories")
      .insert([
        { user_id: userA.id, name: `Planning active ${testRunId}`, kind: "EXPENSE", is_active: true },
        { user_id: userA.id, name: `Planning inactive ${testRunId}`, kind: "EXPENSE", is_active: false },
      ])
      .select("id,is_active");
    if (categoryError || !categories || categories.length !== 2) {
      throw new Error(categoryError?.message ?? "Missing planning categories");
    }
    activeCategoryId = categories.find((category) => category.is_active)?.id ?? "";
    inactiveCategoryId = categories.find((category) => !category.is_active)?.id ?? "";
    if (!activeCategoryId || !inactiveCategoryId) throw new Error("Missing active or inactive category");

    userAClient = await authenticatedClient(userA);
    userBClient = await authenticatedClient(userB);
  });

  afterAll(async () => {
    await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
    await Promise.all([userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)));
  });

  describe("TC-PLAN savings contribution transfer integrity", () => {
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

describe("TC-PLAN planning repository and service", () => {
  it("performs monthly and category budget CRUD for the current user", async () => {
    const service = createPlanningService(createPlanningRepository(userAClient));

    const monthly = await service.createMonthlyBudget(userA.id, {
      year: 2026,
      month: 9,
      totalBudget: 1_200_000,
    });
    expect(monthly).toMatchObject({ userId: userA.id, year: 2026, month: 9, totalBudget: 1_200_000 });
    await expect(service.listMonthlyBudgets(userA.id)).resolves.toContainEqual(expect.objectContaining({ id: monthly.id }));

    const updatedMonthly = await service.updateMonthlyBudget(userA.id, monthly.id, {
      year: 2026,
      month: 9,
      totalBudget: 1_350_000,
    });
    expect(updatedMonthly).toMatchObject({ id: monthly.id, totalBudget: 1_350_000 });
    await service.removeMonthlyBudget(userA.id, monthly.id);
    await expect(service.listMonthlyBudgets(userA.id)).resolves.not.toContainEqual(expect.objectContaining({ id: monthly.id }));

    const category = await service.createCategoryBudget(userA.id, {
      year: 2026,
      month: 9,
      categoryId: activeCategoryId,
      baseBudget: 400_000,
      rolloverEnabled: true,
      rolloverAmount: -25_000,
    });
    expect(category).toMatchObject({
      userId: userA.id,
      year: 2026,
      month: 9,
      categoryId: activeCategoryId,
      baseBudget: 400_000,
      rolloverEnabled: true,
      rolloverAmount: -25_000,
    });
    await expect(service.listCategoryBudgets(userA.id)).resolves.toContainEqual(expect.objectContaining({ id: category.id }));

    const updatedCategory = await service.updateCategoryBudget(userA.id, category.id, {
      year: 2026,
      month: 9,
      categoryId: activeCategoryId,
      baseBudget: 450_000,
      rolloverEnabled: false,
      rolloverAmount: 0,
    });
    expect(updatedCategory).toMatchObject({ id: category.id, baseBudget: 450_000, rolloverEnabled: false });
    await service.removeCategoryBudget(userA.id, category.id);
    await expect(service.listCategoryBudgets(userA.id)).resolves.not.toContainEqual(expect.objectContaining({ id: category.id }));
  });

  it("upserts budgets by their documented period keys", async () => {
    const service = createPlanningService(createPlanningRepository(userAClient));

    const firstMonthly = await service.createMonthlyBudget(userA.id, { year: 2026, month: 10, totalBudget: 100_000 });
    const secondMonthly = await service.createMonthlyBudget(userA.id, { year: 2026, month: 10, totalBudget: 200_000 });
    expect(secondMonthly).toMatchObject({ id: firstMonthly.id, totalBudget: 200_000 });

    const firstCategory = await service.createCategoryBudget(userA.id, {
      year: 2026, month: 10, categoryId: activeCategoryId, baseBudget: 10_000, rolloverEnabled: false, rolloverAmount: 0,
    });
    const secondCategory = await service.createCategoryBudget(userA.id, {
      year: 2026, month: 10, categoryId: activeCategoryId, baseBudget: 20_000, rolloverEnabled: true, rolloverAmount: 1_000,
    });
    expect(secondCategory).toMatchObject({ id: firstCategory.id, baseBudget: 20_000, rolloverEnabled: true, rolloverAmount: 1_000 });
  });

  it("creates, updates, lists, and deactivates savings goals", async () => {
    const service = createPlanningService(createPlanningRepository(userAClient));
    const created = await service.createSavingsGoal(userA.id, {
      name: " Emergency reserve ",
      targetAmount: 3_000_000,
      targetDate: "2027-08-11",
      monthlyContributionPlan: 250_000,
    });
    expect(created).toMatchObject({ name: "Emergency reserve", isActive: true, targetAmount: 3_000_000 });
    await expect(service.listSavingsGoals(userA.id)).resolves.toContainEqual(expect.objectContaining({ id: created.id }));

    const updated = await service.updateSavingsGoal(userA.id, created.id, {
      name: "Emergency reserve 2",
      targetAmount: 3_500_000,
      targetDate: "2027-12-31",
      monthlyContributionPlan: 300_000,
    });
    expect(updated).toMatchObject({ id: created.id, targetAmount: 3_500_000, monthlyContributionPlan: 300_000 });
    await service.deactivateSavingsGoal(userA.id, created.id);
    await expect(service.listSavingsGoals(userA.id)).resolves.toContainEqual(expect.objectContaining({ id: created.id, isActive: false }));
  });

  it("creates, updates, lists, and removes standalone and transfer-linked contributions", async () => {
    const service = createPlanningService(createPlanningRepository(userAClient));
    const standalone = await service.createSavingsContribution(userA.id, {
      goalId: goalIds[0], amount: 50_000, contributionDate: "2026-08-11",
    });
    expect(standalone).toMatchObject({ goalId: goalIds[0], amount: 50_000, contributionDate: "2026-08-11" });
    expect(standalone).not.toHaveProperty("transferId");

    const transferId = await createTransfer(userAClient, userA.id, userABankAccountIds);
    const linked = await service.createSavingsContribution(userA.id, {
      goalId: goalIds[1], amount: 75_000, contributionDate: "2026-08-12", transferId,
    });
    expect(linked).toMatchObject({ goalId: goalIds[1], amount: 75_000, transferId });
    await expect(service.listSavingsContributions(userA.id)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: standalone.id }),
      expect.objectContaining({ id: linked.id }),
    ]));

    const updated = await service.updateSavingsContribution(userA.id, standalone.id, {
      goalId: goalIds[0], amount: 60_000, contributionDate: "2026-08-13",
    });
    expect(updated).toMatchObject({ id: standalone.id, amount: 60_000 });
    expect(updated).not.toHaveProperty("transferId");
    await service.removeSavingsContribution(userA.id, standalone.id);
    await expect(service.listSavingsContributions(userA.id)).resolves.not.toContainEqual(expect.objectContaining({ id: standalone.id }));

    const updatedLinked = await service.updateSavingsContribution(userA.id, linked.id, {
      goalId: goalIds[1], amount: 80_000, contributionDate: "2026-08-13", transferId,
    });
    expect(updatedLinked).toMatchObject({ id: linked.id, amount: 80_000, contributionDate: "2026-08-13", transferId });
    await service.removeSavingsContribution(userA.id, linked.id);
    await expect(service.listSavingsContributions(userA.id)).resolves.not.toContainEqual(expect.objectContaining({ id: linked.id }));

    const relinked = await service.createSavingsContribution(userA.id, {
      goalId: goalIds[0], amount: 80_000, contributionDate: "2026-08-14", transferId,
    });
    expect(relinked).toMatchObject({ goalId: goalIds[0], transferId });
    await service.removeSavingsContribution(userA.id, relinked.id);
  });

  it("rejects inactive categories and prevents cross-user reads and mutations", async () => {
    const ownerService = createPlanningService(createPlanningRepository(userAClient));
    const otherService = createPlanningService(createPlanningRepository(userBClient));
    const monthly = await ownerService.createMonthlyBudget(userA.id, { year: 2026, month: 11, totalBudget: 300_000 });
    const category = await ownerService.createCategoryBudget(userA.id, {
      year: 2026, month: 11, categoryId: activeCategoryId, baseBudget: 30_000, rolloverEnabled: false, rolloverAmount: 0,
    });
    const goal = await ownerService.createSavingsGoal(userA.id, {
      name: "Isolation goal", targetAmount: 100_000, targetDate: "2026-12-31", monthlyContributionPlan: 20_000,
    });
    const contribution = await ownerService.createSavingsContribution(userA.id, {
      goalId: goal.id, amount: 10_000, contributionDate: "2026-08-11",
    });

    await expect(ownerService.createCategoryBudget(userA.id, {
      year: 2026, month: 12, categoryId: inactiveCategoryId, baseBudget: 1, rolloverEnabled: false, rolloverAmount: 0,
    })).rejects.toThrow("active category owned by the current user");

    await expect(otherService.listMonthlyBudgets(userB.id)).resolves.not.toContainEqual(expect.objectContaining({ id: monthly.id }));
    await expect(otherService.listCategoryBudgets(userB.id)).resolves.not.toContainEqual(expect.objectContaining({ id: category.id }));
    await expect(otherService.listSavingsGoals(userB.id)).resolves.not.toContainEqual(expect.objectContaining({ id: goal.id }));
    await expect(otherService.listSavingsContributions(userB.id)).resolves.not.toContainEqual(expect.objectContaining({ id: contribution.id }));
    await expect(otherService.updateMonthlyBudget(userB.id, monthly.id, { year: 2026, month: 11, totalBudget: 1 })).rejects.toThrow("not found");
    await expect(otherService.removeCategoryBudget(userB.id, category.id)).rejects.toThrow("not found");
    await expect(otherService.updateSavingsGoal(userB.id, goal.id, {
      name: "Changed", targetAmount: 1, targetDate: "2026-12-31", monthlyContributionPlan: 0,
    })).rejects.toThrow("not found");
    await expect(otherService.removeSavingsContribution(userB.id, contribution.id)).rejects.toThrow("not found");
  });
});
});
