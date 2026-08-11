import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createPlannedRepository } from "@/server/planned/repository";
import { createPlannedTransactionService } from "@/server/planned/service";
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
let accountId: string;
let categoryId: string;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-planned-${label}-${testRunId}@example.test`;
  const password = `PlannedTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Unable to create planned test user: ${error?.message ?? "unknown error"}`);
  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

function plannedInput(overrides: Record<string, unknown> = {}) {
  return {
    type: "EXPENSE" as const,
    scheduledDate: "2026-09-01",
    amount: 50_000,
    currency: "KRW",
    accountId,
    categoryId,
    memo: `TC-PLAN-${testRunId}`,
    ...overrides,
  };
}

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");

  const { error: profileError } = await admin.from("profiles").insert([
    { id: userA.id, display_name: "Planned User A", salary_cycle_day: 1 },
    { id: userB.id, display_name: "Planned User B", salary_cycle_day: 1 },
  ]);
  if (profileError) throw new Error(profileError.message);

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .insert({ user_id: userA.id, name: "Planned bank", type: "BANK" })
    .select("id")
    .single();
  if (accountError || !account) throw new Error(accountError?.message ?? "Missing account");
  accountId = account.id;

  const { data: category, error: categoryError } = await admin
    .from("categories")
    .insert({ user_id: userA.id, name: `Planned-${testRunId}`, kind: "EXPENSE" })
    .select("id")
    .single();
  if (categoryError || !category) throw new Error(categoryError?.message ?? "Missing category");
  categoryId = category.id;

  userAClient = await authenticatedClient(userA);
  userBClient = await authenticatedClient(userB);
});

afterAll(async () => {
  await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
  await Promise.all([userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)));
});

describe("TC-PLAN planned transaction workflow", () => {
  it("creates, lists, and updates a PLANNED transaction owned by the current user", async () => {
    const service = createPlannedTransactionService(createPlannedRepository(userAClient));

    const created = await service.create(userA.id, plannedInput());
    expect(created).toMatchObject({ status: "PLANNED", amount: 50_000, currency: "KRW" });

    await expect(service.list(userA.id)).resolves.toContainEqual(expect.objectContaining({ id: created.id }));

    const updated = await service.update(userA.id, created.id, plannedInput({ memo: "Updated memo" }));
    expect(updated).toMatchObject({ id: created.id, memo: "Updated memo" });
  });

  it("confirms a PLANNED transaction into a real CONFIRMED expense exactly once", async () => {
    const service = createPlannedTransactionService(createPlannedRepository(userAClient));
    const created = await service.create(userA.id, plannedInput({ memo: `confirm-${testRunId}` }));

    const confirmed = await service.confirm(userA.id, created.id);
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.convertedTransactionId).toBeTruthy();

    const { data: transaction, error } = await admin
      .from("transactions")
      .select("type,status,amount,account_id,category_id,planned_transaction_id")
      .eq("id", confirmed.convertedTransactionId as string)
      .single();
    if (error) throw new Error(error.message);
    expect(transaction).toMatchObject({
      type: "EXPENSE",
      status: "CONFIRMED",
      amount: 50_000,
      account_id: accountId,
      category_id: categoryId,
      planned_transaction_id: created.id,
    });

    await expect(service.confirm(userA.id, created.id)).rejects.toThrow("already confirmed");
    await expect(service.remove(userA.id, created.id)).rejects.toThrow("confirmed planned transaction cannot be deleted");
  });

  it("removes a PLANNED transaction that was never confirmed", async () => {
    const service = createPlannedTransactionService(createPlannedRepository(userAClient));
    const created = await service.create(userA.id, plannedInput({ memo: `delete-${testRunId}` }));

    await service.remove(userA.id, created.id);

    await expect(service.list(userA.id)).resolves.not.toContainEqual(expect.objectContaining({ id: created.id }));
  });

  it("does not allow another user to read, update, delete, or confirm a planned transaction", async () => {
    const ownerService = createPlannedTransactionService(createPlannedRepository(userAClient));
    const created = await ownerService.create(userA.id, plannedInput({ memo: `isolation-${testRunId}` }));

    const otherService = createPlannedTransactionService(createPlannedRepository(userBClient));
    await expect(otherService.list(userB.id)).resolves.not.toContainEqual(expect.objectContaining({ id: created.id }));
    await expect(otherService.update(userB.id, created.id, plannedInput())).rejects.toThrow("not found");
    await expect(otherService.remove(userB.id, created.id)).rejects.toThrow("not found");
    await expect(otherService.confirm(userB.id, created.id)).rejects.toThrow("not found");
  });
});
