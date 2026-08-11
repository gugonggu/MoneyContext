import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { NotificationCandidate } from "@/domain/notifications/rules";
import { createNotificationRepository } from "@/server/notifications/repository";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

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
let notificationId: string;
let unconvertedPlannedTransactionId: string;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-notifications-${label}-${testRunId}@example.test`;
  const password = `NotificationsTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Unable to create notification test user: ${error?.message ?? "unknown error"}`);
  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: `money-context-notifications-${user.id}` },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

describeWithSupabase("notification row-level security", () => {
  beforeAll(async () => {
    admin = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false, storageKey: `money-context-notifications-admin-${testRunId}` },
    });
    userA = await createTestUser("a");
    userB = await createTestUser("b");

    const { error: profileError } = await admin.from("profiles").insert([
      { id: userA.id, display_name: "Notification User A", salary_cycle_day: 1 },
      { id: userB.id, display_name: "Notification User B", salary_cycle_day: 1 },
    ]);
    if (profileError) throw new Error(profileError.message);

    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: userA.id,
        type: "PLANNED_DUE",
        title: "A only",
        message: "Visible only to A",
        dedupe_key: `a-only-${testRunId}`,
        dedupe_day: "2026-08-11",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Unable to create notification");
    notificationId = data.id;

    const { data: plannedTransaction, error: plannedTransactionError } = await admin
      .from("planned_transactions")
      .insert({
        user_id: userA.id,
        type: "EXPENSE",
        status: "PLANNED",
        scheduled_date: "2026-08-11",
        amount: 100,
        currency: "USD",
        base_amount: null,
      })
      .select("id")
      .single();
    if (plannedTransactionError || !plannedTransaction) {
      throw new Error(plannedTransactionError?.message ?? "Unable to create unconverted planned transaction");
    }
    unconvertedPlannedTransactionId = plannedTransaction.id;

    userAClient = await authenticatedClient(userA);
    userBClient = await authenticatedClient(userB);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
    await Promise.all([userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)));
  });

  it("does not allow user B to list or mark user A's notification as read", async () => {
    const { data: ownRows, error: ownReadError } = await userAClient.from("notifications").select("id");
    if (ownReadError) throw new Error(ownReadError.message);
    expect(ownRows).toEqual([{ id: notificationId }]);

    const { data: otherRows, error: otherReadError } = await userBClient.from("notifications").select("id");
    if (otherReadError) throw new Error(otherReadError.message);
    expect(otherRows).toEqual([]);

    const { data: updatedRows, error: updateError } = await userBClient
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    expect(updatedRows).toEqual([]);

    const { data: notification, error: verificationError } = await userAClient
      .from("notifications")
      .select("is_read,read_at")
      .eq("id", notificationId)
      .single();
    if (verificationError) throw new Error(verificationError.message);
    expect(notification).toEqual({ is_read: false, read_at: null });
  });

  it("omits planned transactions whose base amount has not been converted", async () => {
    const input = await createNotificationRepository(admin).getRuleInput(userA.id, "2026-08-11");

    expect(input.plannedTransactions.find((transaction) => transaction.id === unconvertedPlannedTransactionId)).toBeUndefined();
  });

  it("enforces one user-scoped notification dedupe key for each Seoul day", async () => {
    const payload = {
      user_id: userB.id,
      type: "PLANNED_DUE" as const,
      title: "Dedupe test",
      message: "Only one row may use this key today.",
      dedupe_key: `dedupe-${testRunId}`,
      dedupe_day: "2026-08-11",
    };
    const { error: firstInsertError } = await userBClient.from("notifications").insert(payload);
    if (firstInsertError) throw new Error(firstInsertError.message);

    const { error: duplicateInsertError } = await userBClient.from("notifications").insert(payload);
    expect(duplicateInsertError?.code).toBe("23505");
  });

  it("preserves a notification unique-conflict code for the refresh service", async () => {
    const candidate: NotificationCandidate = {
      type: "PLANNED_DUE",
      title: "Repository conflict test",
      message: "The service must recognize this conflict.",
      relatedEntityType: "planned_transaction",
      relatedEntityId: randomUUID(),
      dedupeKey: `repository-conflict-${testRunId}`,
    };
    const repository = createNotificationRepository(userBClient);

    await repository.insert(userB.id, candidate, "2026-08-11");
    await expect(repository.insert(userB.id, candidate, "2026-08-11")).rejects.toMatchObject({ code: "23505" });
  });
});
