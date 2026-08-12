import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteCurrentUserAccount } from "@/server/account/delete";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();

let user: TestUser;

async function createTestUser(): Promise<TestUser> {
  const email = `money-context-account-delete-${testRunId}@example.test`;
  const password = `AccountDeleteTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create test user");
  return { id: data.user.id, email, password };
}

let tagId: string;

beforeAll(async () => {
  user = await createTestUser();
  const { error } = await admin.from("profiles").insert({ id: user.id, display_name: "Account Delete User", salary_cycle_day: 1, base_currency: "KRW" });
  if (error) throw new Error(error.message);
  const { data: account, error: accountError } = await admin.from("accounts").insert({ user_id: user.id, name: "account delete test account", type: "CASH" }).select("id").single();
  if (accountError || !account) throw new Error(accountError?.message ?? "Missing account");

  // A tagged transaction exercises the transaction_tags -> tags cascade path
  // (previously missing ON DELETE CASCADE on tag_id — see migration
  // 20260812140000_cascade_transaction_tags_tag_id.sql), not just the
  // transaction_tags -> transactions path the original fixture covered.
  const { data: tag, error: tagError } = await admin.from("tags").insert({ user_id: user.id, name: "account delete test tag" }).select("id").single();
  if (tagError || !tag) throw new Error(tagError?.message ?? "Missing tag");
  tagId = tag.id;

  const { data: transaction, error: transactionError } = await admin
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "EXPENSE",
      status: "CONFIRMED",
      transaction_at: "2026-08-10T00:00:00+09:00",
      amount: 1000,
      currency: "KRW",
      base_amount: 1000,
      base_currency: "KRW",
      account_id: account.id,
    })
    .select("id")
    .single();
  if (transactionError || !transaction) throw new Error(transactionError?.message ?? "Missing transaction");

  const { error: tagAssignError } = await admin.from("transaction_tags").insert({ transaction_id: transaction.id, tag_id: tagId });
  if (tagAssignError) throw new Error(tagAssignError.message);
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
});

describe("account deletion", () => {
  it("rejects deleting a user id that does not exist", async () => {
    await expect(deleteCurrentUserAccount(randomUUID())).rejects.toThrow();
  });

  it("cascades to remove the profile and all owned data", async () => {
    await deleteCurrentUserAccount(user.id);

    const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
    expect(profile).toBeNull();

    const { data: accounts } = await admin.from("accounts").select("id").eq("user_id", user.id);
    expect(accounts).toEqual([]);

    const { data: tags } = await admin.from("tags").select("id").eq("id", tagId);
    expect(tags).toEqual([]);

    const { data: authUser } = await admin.auth.admin.getUserById(user.id);
    expect(authUser.user).toBeNull();
  });
});
