import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createBackupRepository } from "@/server/backup/repository";
import { createBackupService } from "@/server/backup/service";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

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

async function seedFinancialGraph(client: SupabaseClient, user: TestUser, label: string): Promise<void> {
  const [{ data: bankA, error: bankAError }, { data: bankB, error: bankBError }, { data: category, error: categoryError }] = await Promise.all([
    client.from("accounts").insert({ user_id: user.id, name: `${label} bank A`, type: "BANK" }).select("id").single(),
    client.from("accounts").insert({ user_id: user.id, name: `${label} bank B`, type: "BANK" }).select("id").single(),
    client.from("categories").insert({ user_id: user.id, name: `${label} food`, kind: "EXPENSE" }).select("id").single(),
  ]);
  if (bankAError || bankBError || categoryError || !bankA || !bankB || !category) throw new Error("Unable to seed restore graph roots");

  const { error } = await client.from("transactions").insert({
    user_id: user.id,
    type: "EXPENSE",
    status: "CONFIRMED",
    transaction_at: "2026-08-12T12:00:00+09:00",
    amount: 1000,
    currency: "KRW",
    base_amount: 1000,
    base_currency: "KRW",
    account_id: bankA.id,
    category_id: category.id,
  });
  if (error) throw new Error(error.message);
}

async function names(client: SupabaseClient, table: "accounts" | "categories"): Promise<string[]> {
  const { data, error } = await client.from(table).select("name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.name);
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
  it("replaces the current user's financial graph with a remapped backup", async () => {
    await seedFinancialGraph(userAClient, userA, "round trip");
    const service = createBackupService(createBackupRepository(userAClient));
    const backup = await service.generate(userA.id);

    const { error } = await userAClient.from("accounts").insert({ user_id: userA.id, name: "round trip stale", type: "BANK" });
    if (error) throw new Error(error.message);

    await service.restore(userA.id, backup);

    await expect(names(userAClient, "accounts")).resolves.toEqual(["round trip bank A", "round trip bank B"]);
    await expect(names(userAClient, "categories")).resolves.toEqual(["round trip food"]);
    const restored = await service.generate(userA.id);
    expect(restored.transactions).toHaveLength(1);
    expect(restored.transactions[0]).toMatchObject({ type: "EXPENSE", amount: 1000, user_id: userA.id });
  });

  it("ignores payload ownership ids and never replaces another user's graph", async () => {
    await seedFinancialGraph(userAClient, userA, "cross user A");
    await seedFinancialGraph(userBClient, userB, "cross user B");
    const service = createBackupService(createBackupRepository(userAClient));
    const backup = await service.generate(userA.id);
    const expectedUserAAccounts = await names(userAClient, "accounts");
    const otherUserPayload = structuredClone(backup);
    otherUserPayload.profile.id = userB.id;
    for (const collection of ["accounts", "credit_card_settings", "categories", "tags", "transactions", "recurring_transactions", "planned_transactions", "installment_plans", "installment_payments", "monthly_budgets", "category_budgets", "savings_goals", "savings_contributions"] as const) {
      otherUserPayload[collection].forEach((row) => { row.user_id = userB.id; });
    }

    await service.restore(userA.id, otherUserPayload);

    await expect(names(userBClient, "accounts")).resolves.toEqual(["cross user B bank A", "cross user B bank B"]);
    await expect(names(userBClient, "categories")).resolves.toEqual(["cross user B food"]);
    await expect(names(userAClient, "accounts")).resolves.toEqual(expectedUserAAccounts);
  });

  it("rolls back the replacement when a database write fails", async () => {
    await seedFinancialGraph(userAClient, userA, "rollback");
    const service = createBackupService(createBackupRepository(userAClient));
    const backup = await service.generate(userA.id);
    const invalidAtWrite = structuredClone(backup);
    invalidAtWrite.accounts[0].linked_account_id = invalidAtWrite.accounts[1].id;

    await expect(service.restore(userA.id, invalidAtWrite)).rejects.toThrow();
    await expect(names(userAClient, "accounts")).resolves.toContain("rollback bank A");
    await expect(names(userAClient, "accounts")).resolves.toContain("rollback bank B");
  });
});
