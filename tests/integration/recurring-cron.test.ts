import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();

let userA: TestUser;
let userB: TestUser;
let accountAId: string;
let accountBId: string;
let ruleAId: string;
let ruleBId: string;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-recurring-cron-${label}-${testRunId}@example.test`;
  const password = `RecurringCronTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create test user");
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, display_name: label, salary_cycle_day: 1, base_currency: "KRW" });
  if (profileError) throw new Error(profileError.message);
  return { id: data.user.id, email, password };
}

async function createDueRule(userId: string, accountId: string): Promise<string> {
  const { data, error } = await admin
    .from("recurring_transactions")
    .insert({
      user_id: userId,
      type: "EXPENSE",
      amount: 10000,
      currency: "KRW",
      account_id: accountId,
      frequency: "MONTHLY",
      interval_count: 1,
      day_of_month: 1,
      start_date: "2026-08-01",
      next_run_date: "2026-08-01",
      confirmation_mode: "AUTO_CONFIRM",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Unable to create recurring rule");
  return data.id;
}

async function transactionCountFor(ruleId: string): Promise<number> {
  const { count, error } = await admin.from("transactions").select("id", { count: "exact", head: true }).eq("recurring_rule_id", ruleId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

beforeAll(async () => {
  [userA, userB] = await Promise.all([createTestUser("a"), createTestUser("b")]);
  const [accountA, accountB] = await Promise.all([
    admin.from("accounts").insert({ user_id: userA.id, name: "recurring cron A bank", type: "BANK" }).select("id").single(),
    admin.from("accounts").insert({ user_id: userB.id, name: "recurring cron B bank", type: "BANK" }).select("id").single(),
  ]);
  if (accountA.error || !accountA.data) throw new Error(accountA.error?.message ?? "Missing account A");
  if (accountB.error || !accountB.data) throw new Error(accountB.error?.message ?? "Missing account B");
  accountAId = accountA.data.id;
  accountBId = accountB.data.id;
  [ruleAId, ruleBId] = await Promise.all([createDueRule(userA.id, accountAId), createDueRule(userB.id, accountBId)]);
});

afterAll(async () => {
  await Promise.all([admin.auth.admin.deleteUser(userA.id), admin.auth.admin.deleteUser(userB.id)]);
});

describe("recurring transaction cron (all users)", () => {
  it("generates due occurrences for every user's rules in one call, and is idempotent", async () => {
    const { runRecurringTransactionCron } = await import("@/server/recurring/cron");

    const firstRun = await runRecurringTransactionCron("2026-08-01");
    const ruleIds = firstRun.map((occurrence) => occurrence.ruleId);
    expect(ruleIds).toContain(ruleAId);
    expect(ruleIds).toContain(ruleBId);

    expect(await transactionCountFor(ruleAId)).toBe(1);
    expect(await transactionCountFor(ruleBId)).toBe(1);

    const secondRun = await runRecurringTransactionCron("2026-08-01");
    expect(secondRun.map((occurrence) => occurrence.ruleId)).not.toContain(ruleAId);
    expect(secondRun.map((occurrence) => occurrence.ruleId)).not.toContain(ruleBId);
    expect(await transactionCountFor(ruleAId)).toBe(1);
    expect(await transactionCountFor(ruleBId)).toBe(1);
  });

  it("rejects a direct RPC call from an authenticated (non-service-role) client", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { getSupabasePublicConfig } = await import("@/lib/supabase/config");
    const { url, anonKey } = getSupabasePublicConfig();
    const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false, storageKey: `money-context-recurring-cron-direct-${userA.id}` } });
    const { error: signInError } = await client.auth.signInWithPassword({ email: userA.email, password: userA.password });
    if (signInError) throw new Error(signInError.message);

    const { error } = await client.rpc("generate_due_recurring_transactions_for_all_users", { input_today: "2026-08-01" });
    expect(error).not.toBeNull();
  });
});

describe("GET /api/cron/recurring", () => {
  it("rejects a missing or incorrect bearer secret and never runs the cron", async () => {
    vi.stubEnv("CRON_SECRET", "expected-secret");
    const runRecurringTransactionCron = vi.fn();
    vi.doMock("@/server/recurring/cron", () => ({ runRecurringTransactionCron }));
    vi.resetModules();

    const { GET } = await import("@/app/api/cron/recurring/route");

    const missing = await GET(new Request("http://localhost/api/cron/recurring"));
    expect(missing.status).toBe(401);

    const wrong = await GET(new Request("http://localhost/api/cron/recurring", { headers: { authorization: "Bearer wrong-secret" } }));
    expect(wrong.status).toBe(401);

    expect(runRecurringTransactionCron).not.toHaveBeenCalled();
    vi.doUnmock("@/server/recurring/cron");
    vi.unstubAllEnvs();
  });

  it("runs the cron and reports the generated count when the secret matches", async () => {
    vi.stubEnv("CRON_SECRET", "expected-secret");
    const runRecurringTransactionCron = vi.fn(async () => [{ ruleId: "r1", occurrenceDate: "2026-08-01", status: "CONFIRMED" as const }]);
    vi.doMock("@/server/recurring/cron", () => ({ runRecurringTransactionCron }));
    vi.resetModules();

    const { GET } = await import("@/app/api/cron/recurring/route");
    const response = await GET(new Request("http://localhost/api/cron/recurring", { headers: { authorization: "Bearer expected-secret" } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ generated: 1 });
    vi.doUnmock("@/server/recurring/cron");
    vi.unstubAllEnvs();
  });
});
