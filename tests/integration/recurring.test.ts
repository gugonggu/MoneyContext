import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type TestUser = Readonly<{
  id: string;
  email: string;
  password: string;
}>;

type GeneratedOccurrence = Readonly<{
  ruleId: string;
  occurrenceDate: string;
  status: "CONFIRMED" | "PENDING";
}>;

type RuleFixtures = Readonly<{
  account: string;
  category: string;
  autoConfirm: string;
  requireConfirmation: string;
  inactive: string;
  future: string;
  ended: string;
  preexistingOccurrence: string;
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
let fixtures: RuleFixtures;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-recurring-${label}-${testRunId}@example.test`;
  const password = `RecurringTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });

  if (error || !data.user) {
    throw new Error(`Unable to create recurring test user: ${error?.message ?? "unknown error"}`);
  }

  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: `money-context-recurring-${user.id}`,
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

async function generateDueAs(client: SupabaseClient, today: string): Promise<GeneratedOccurrence[]> {
  const { data, error } = await client.rpc("generate_due_recurring_transactions", { input_today: today });
  if (error) throw new Error(error.message);

  return (data as Array<Record<string, unknown>>).map((row) => ({
    ruleId: String(row.rule_id),
    occurrenceDate: String(row.occurrence_date),
    status: row.transaction_status as GeneratedOccurrence["status"],
  }));
}

async function transactionsFor(client: SupabaseClient, ruleId: string, occurrenceDate: string) {
  const { data, error } = await client
    .from("transactions")
    .select("type,status,transaction_at,amount,currency,base_amount,base_currency,account_id,category_id,memo")
    .eq("recurring_rule_id", ruleId)
    .eq("recurring_occurrence_date", occurrenceDate);
  if (error) throw new Error(error.message);
  return data;
}

async function confirmedIncomeFor(client: SupabaseClient): Promise<number> {
  const { data, error } = await client
    .from("transactions")
    .select("base_amount")
    .eq("type", "INCOME")
    .eq("status", "CONFIRMED");
  if (error) throw new Error(error.message);
  return data.reduce((total, transaction) => total + Number(transaction.base_amount), 0);
}

describeWithSupabase("TC-REC recurring transaction generation", () => {
  beforeAll(async () => {
    admin = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `money-context-recurring-admin-${testRunId}`,
      },
    });
    userA = await createTestUser("a");
    userB = await createTestUser("b");

    const { error: profileError } = await admin.from("profiles").insert([
      { id: userA.id, display_name: "Recurring User A", salary_cycle_day: 1 },
      { id: userB.id, display_name: "Recurring User B", salary_cycle_day: 1 },
    ]);
    if (profileError) throw new Error(profileError.message);

    const { data: account, error: accountError } = await admin
      .from("accounts")
      .insert({ user_id: userA.id, name: "Recurring bank", type: "BANK" })
      .select("id")
      .single();
    if (accountError || !account) throw new Error(accountError?.message ?? "Missing account");

    const { data: category, error: categoryError } = await admin
      .from("categories")
      .insert({ user_id: userA.id, name: `Recurring-${testRunId}`, kind: "EXPENSE" })
      .select("id")
      .single();
    if (categoryError || !category) throw new Error(categoryError?.message ?? "Missing category");

    const baseRule = {
      user_id: userA.id,
      currency: "KRW",
      account_id: account.id,
      frequency: "MONTHLY",
      interval_count: 1,
      day_of_month: 15,
      start_date: "2026-08-15",
      next_run_date: "2026-08-15",
      is_active: true,
    };
    const { data: rules, error: ruleError } = await admin
      .from("recurring_transactions")
      .insert([
        {
          ...baseRule,
          type: "EXPENSE",
          amount: 14_900,
          category_id: category.id,
          memo: "Streaming subscription",
          confirmation_mode: "AUTO_CONFIRM",
        },
        {
          ...baseRule,
          type: "INCOME",
          amount: 2_156_880,
          category_id: null,
          memo: "Salary",
          confirmation_mode: "REQUIRE_CONFIRMATION",
        },
        {
          ...baseRule,
          type: "EXPENSE",
          amount: 1_000,
          category_id: category.id,
          confirmation_mode: "AUTO_CONFIRM",
          is_active: false,
        },
        {
          ...baseRule,
          type: "EXPENSE",
          amount: 2_000,
          category_id: category.id,
          confirmation_mode: "AUTO_CONFIRM",
          start_date: "2026-08-16",
          next_run_date: "2026-08-16",
          day_of_month: 16,
        },
        {
          ...baseRule,
          type: "EXPENSE",
          amount: 3_000,
          category_id: category.id,
          confirmation_mode: "AUTO_CONFIRM",
          start_date: "2026-07-15",
          end_date: "2026-07-31",
        },
        {
          ...baseRule,
          type: "EXPENSE",
          amount: 4_000,
          category_id: category.id,
          memo: "Preexisting occurrence",
          confirmation_mode: "AUTO_CONFIRM",
        },
      ])
      .select("id,amount");
    if (ruleError || !rules) throw new Error(ruleError?.message ?? "Missing recurring rules");

    const ruleIdByAmount = new Map(rules.map((rule) => [Number(rule.amount), String(rule.id)]));
    fixtures = {
      account: account.id,
      category: category.id,
      autoConfirm: ruleIdByAmount.get(14_900)!,
      requireConfirmation: ruleIdByAmount.get(2_156_880)!,
      inactive: ruleIdByAmount.get(1_000)!,
      future: ruleIdByAmount.get(2_000)!,
      ended: ruleIdByAmount.get(3_000)!,
      preexistingOccurrence: ruleIdByAmount.get(4_000)!,
    };

    const { error: existingOccurrenceError } = await admin.from("transactions").insert({
      user_id: userA.id,
      type: "EXPENSE",
      status: "CONFIRMED",
      transaction_at: "2026-08-14T15:00:00.000Z",
      amount: 4_000,
      currency: "KRW",
      base_amount: 4_000,
      base_currency: "KRW",
      category_id: category.id,
      account_id: account.id,
      memo: "Preexisting occurrence",
      recurring_rule_id: fixtures.preexistingOccurrence,
      recurring_occurrence_date: "2026-08-15",
    });
    if (existingOccurrenceError) throw new Error(existingOccurrenceError.message);

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

  it("requires an authenticated caller", async () => {
    const anonymous = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `money-context-recurring-anonymous-${testRunId}`,
      },
    });
    const { error } = await anonymous.rpc("generate_due_recurring_transactions", {
      input_today: "2026-08-15",
    });

    expect(error).not.toBeNull();
  });

  it("generates only the current user's active due occurrences exactly once", async () => {
    await expect(generateDueAs(userBClient, "2026-08-15")).resolves.toEqual([]);

    const firstRun = await generateDueAs(userAClient, "2026-08-15");
    expect(firstRun).toContainEqual({
      ruleId: fixtures.autoConfirm,
      occurrenceDate: "2026-08-15",
      status: "CONFIRMED",
    });
    expect(firstRun).toContainEqual({
      ruleId: fixtures.requireConfirmation,
      occurrenceDate: "2026-08-15",
      status: "PENDING",
    });
    expect(firstRun).toHaveLength(2);

    await expect(generateDueAs(userAClient, "2026-08-15")).resolves.toEqual([]);

    const expense = await transactionsFor(userAClient, fixtures.autoConfirm, "2026-08-15");
    expect(expense).toHaveLength(1);
    expect(expense[0]).toMatchObject({
      type: "EXPENSE",
      status: "CONFIRMED",
      amount: 14_900,
      currency: "KRW",
      base_amount: 14_900,
      base_currency: "KRW",
      account_id: fixtures.account,
      category_id: fixtures.category,
      memo: "Streaming subscription",
    });
    expect(new Date(expense[0].transaction_at).toISOString()).toBe("2026-08-14T15:00:00.000Z");

    const income = await transactionsFor(userAClient, fixtures.requireConfirmation, "2026-08-15");
    expect(income).toHaveLength(1);
    expect(income[0]).toMatchObject({
      type: "INCOME",
      status: "PENDING",
      amount: 2_156_880,
      currency: "KRW",
      base_amount: 2_156_880,
      base_currency: "KRW",
      account_id: fixtures.account,
      category_id: null,
      memo: "Salary",
    });
    await expect(confirmedIncomeFor(userAClient)).resolves.toBe(0);

    for (const ruleId of [fixtures.inactive, fixtures.future, fixtures.ended]) {
      await expect(transactionsFor(userAClient, ruleId, "2026-08-15")).resolves.toEqual([]);
    }
    await expect(
      transactionsFor(userAClient, fixtures.preexistingOccurrence, "2026-08-15"),
    ).resolves.toHaveLength(1);

    const { data: advancedRules, error: advancedRuleError } = await userAClient
      .from("recurring_transactions")
      .select("id,next_run_date")
      .in("id", [
        fixtures.autoConfirm,
        fixtures.requireConfirmation,
        fixtures.preexistingOccurrence,
      ]);
    if (advancedRuleError) throw new Error(advancedRuleError.message);
    expect(advancedRules).toEqual(
      expect.arrayContaining([
        { id: fixtures.autoConfirm, next_run_date: "2026-09-15" },
        { id: fixtures.requireConfirmation, next_run_date: "2026-09-15" },
        { id: fixtures.preexistingOccurrence, next_run_date: "2026-09-15" },
      ]),
    );

    const { error: updateError } = await userAClient
      .from("recurring_transactions")
      .update({ amount: 99_999, memo: "Changed rule" })
      .eq("id", fixtures.autoConfirm);
    if (updateError) throw new Error(updateError.message);
    const historical = await transactionsFor(userAClient, fixtures.autoConfirm, "2026-08-15");
    expect(historical).toHaveLength(1);
    expect(historical[0]).toMatchObject({ amount: 14_900, memo: "Streaming subscription" });
  });
});
