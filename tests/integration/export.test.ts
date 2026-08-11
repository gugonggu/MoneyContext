import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createExportRepository } from "@/server/export/repository";
import { createExportService } from "@/server/export/service";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
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
  const email = `money-context-export-${label}-${testRunId}@example.test`;
  const password = `ExportTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create export test user");
  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: `money-context-export-${user.id}` },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

describe("authenticated markdown export read model", () => {
  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("a"), createTestUser("b")]);
    const { error: profileError } = await admin.from("profiles").insert([
      { id: userA.id, display_name: "Export User A", salary_cycle_day: 1, base_currency: "KRW" },
      { id: userB.id, display_name: "Export User B", salary_cycle_day: 1, base_currency: "KRW" },
    ]);
    if (profileError) throw new Error(profileError.message);

    const [{ data: accountsA, error: accountsAError }, { data: accountsB, error: accountsBError }, { data: categoriesA, error: categoriesAError }, { data: categoriesB, error: categoriesBError }, { data: tagsA, error: tagsAError }, { data: tagsB, error: tagsBError }] = await Promise.all([
      admin.from("accounts").insert({ user_id: userA.id, name: "A checking", type: "BANK" }).select("id"),
      admin.from("accounts").insert({ user_id: userB.id, name: "B checking", type: "BANK" }).select("id"),
      admin.from("categories").insert({ user_id: userA.id, name: "A groceries", kind: "EXPENSE" }).select("id"),
      admin.from("categories").insert({ user_id: userB.id, name: "B groceries", kind: "EXPENSE" }).select("id"),
      admin.from("tags").insert({ user_id: userA.id, name: "A essential" }).select("id"),
      admin.from("tags").insert({ user_id: userB.id, name: "B private" }).select("id"),
    ]);
    if (accountsAError || accountsBError || categoriesAError || categoriesBError || tagsAError || tagsBError || !accountsA?.[0] || !accountsB?.[0] || !categoriesA?.[0] || !categoriesB?.[0] || !tagsA?.[0] || !tagsB?.[0]) {
      throw new Error("Unable to create export test records");
    }

    userAClient = await authenticatedClient(userA);
    userBClient = await authenticatedClient(userB);
    const [{ data: transactionA, error: transactionAError }, { data: transactionB, error: transactionBError }] = await Promise.all([
      userAClient.from("transactions").insert({ user_id: userA.id, type: "EXPENSE", status: "CONFIRMED", transaction_at: "2026-08-10T12:00:00+09:00", amount: 10, currency: "USD", base_amount: 1_500, base_currency: "KRW", category_id: categoriesA[0].id, account_id: accountsA[0].id, memo: "A foreign grocery" }).select("id").single(),
      userBClient.from("transactions").insert({ user_id: userB.id, type: "EXPENSE", status: "CONFIRMED", transaction_at: "2026-08-10T12:00:00+09:00", amount: 9, currency: "USD", base_amount: 1_350, base_currency: "KRW", category_id: categoriesB[0].id, account_id: accountsB[0].id, memo: "B private grocery" }).select("id").single(),
    ]);
    if (transactionAError || transactionBError || !transactionA || !transactionB) throw new Error("Unable to create export transactions");
    const [{ error: tagAError }, { error: tagBError }] = await Promise.all([
      userAClient.from("transaction_tags").insert({ transaction_id: transactionA.id, tag_id: tagsA[0].id }),
      userBClient.from("transaction_tags").insert({ transaction_id: transactionB.id, tag_id: tagsB[0].id }),
    ]);
    if (tagAError || tagBError) throw new Error("Unable to tag export transactions");
  });

  afterAll(async () => {
    await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
    await Promise.all([userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)));
  });

  it("maps the current user's category, account, tag, and stored base amount", async () => {
    const repository = createExportRepository(userAClient);
    const readData = await repository.getReadData(userA.id, { startDate: "2026-08-01", endDate: "2026-08-31" });

    expect(readData.transactions).toEqual([expect.objectContaining({
      type: "EXPENSE",
      originalAmount: 10,
      originalCurrency: "USD",
      baseAmount: 1_500,
      categoryName: "A groceries",
      accountName: "A checking",
      tagNames: ["A essential"],
      memo: "A foreign grocery",
    })]);
    expect(readData.financialPosition).toEqual({
      totalAssets: 0,
      totalLiabilities: 1_500,
      creditCardOutstanding: 0,
      netWorth: -1_500,
    });
  });

  it("returns and formats only user A data", async () => {
    const service = createExportService(createExportRepository(userAClient));
    const markdown = await service.generateMarkdown(userA.id, {
      preset: "SPENDING_REVIEW",
      period: { kind: "CUSTOM", startDate: "2026-08-01", endDate: "2026-08-31" },
    });

    expect(markdown).toContain("A groceries");
    expect(markdown).toContain("A checking");
    expect(markdown).toContain("A essential");
    expect(markdown).toContain("1,500 KRW");
    expect(markdown).not.toContain("B groceries");
    expect(markdown).not.toContain("B checking");
    expect(markdown).not.toContain("B private");
    expect(markdown).not.toContain("1,350 KRW");
  });

  it("omits a foreign-currency planned transaction without a stored base amount", async () => {
    const { error } = await userAClient.from("planned_transactions").insert({
      user_id: userA.id,
      type: "EXPENSE",
      status: "PLANNED",
      scheduled_date: "2026-08-20",
      amount: 20,
      currency: "USD",
      base_amount: null,
      base_currency: "KRW",
      memo: "Unconverted foreign plan",
    });
    if (error) throw new Error(error.message);

    const readData = await createExportRepository(userAClient).getReadData(userA.id, {
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });

    expect(readData.plannedCashflows).toEqual([]);
  });

  it("rejects a user A client attempting to export a spoofed user B id", async () => {
    const service = createExportService(createExportRepository(userAClient));

    await expect(service.generateMarkdown(userB.id, {
      preset: "SPENDING_REVIEW",
      period: { kind: "CUSTOM", startDate: "2026-08-01", endDate: "2026-08-31" },
    })).rejects.toThrow("export data was not found");
  });
});
