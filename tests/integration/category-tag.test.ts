import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCategoryTagRepository } from "@/server/categories/repository";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
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
let ownTagId: string;
let ownTransactionId: string;
let otherCategoryId: string;
let otherTagId: string;
let otherTransactionId: string;

async function createTestUser(label: "a" | "b"): Promise<TestUser> {
  const email = `money-context-category-tag-${label}-${testRunId}@example.test`;
  const password = `CategoryTagTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Unable to create category/tag test user: ${error?.message ?? "unknown error"}`);
  return { id: data.user.id, email, password };
}

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");

  const { error: profileError } = await admin.from("profiles").insert([
    { id: userA.id, display_name: "Category Tag User A", salary_cycle_day: 1 },
    { id: userB.id, display_name: "Category Tag User B", salary_cycle_day: 1 },
  ]);
  if (profileError) throw new Error(profileError.message);

  const { data: accountA, error: accountAError } = await admin
    .from("accounts")
    .insert({ user_id: userA.id, name: "Category tag bank A", type: "BANK" })
    .select("id")
    .single();
  if (accountAError || !accountA) throw new Error(accountAError?.message ?? "Missing account A");

  const { data: accountB, error: accountBError } = await admin
    .from("accounts")
    .insert({ user_id: userB.id, name: "Category tag bank B", type: "BANK" })
    .select("id")
    .single();
  if (accountBError || !accountB) throw new Error(accountBError?.message ?? "Missing account B");

  const { data: transactionA, error: transactionAError } = await admin
    .from("transactions")
    .insert({
      user_id: userA.id,
      type: "EXPENSE",
      status: "CONFIRMED",
      transaction_at: "2026-08-10T00:00:00+09:00",
      amount: 1_000,
      currency: "KRW",
      base_amount: 1_000,
      base_currency: "KRW",
      account_id: accountA.id,
    })
    .select("id")
    .single();
  if (transactionAError || !transactionA) throw new Error(transactionAError?.message ?? "Missing transaction A");
  ownTransactionId = transactionA.id;

  const { data: transactionB, error: transactionBError } = await admin
    .from("transactions")
    .insert({
      user_id: userB.id,
      type: "EXPENSE",
      status: "CONFIRMED",
      transaction_at: "2026-08-10T00:00:00+09:00",
      amount: 1_000,
      currency: "KRW",
      base_amount: 1_000,
      base_currency: "KRW",
      account_id: accountB.id,
    })
    .select("id")
    .single();
  if (transactionBError || !transactionB) throw new Error(transactionBError?.message ?? "Missing transaction B");
  otherTransactionId = transactionB.id;

  const { data: tagA, error: tagAError } = await admin
    .from("tags")
    .insert({ user_id: userA.id, name: `own-tag-${testRunId}` })
    .select("id")
    .single();
  if (tagAError || !tagA) throw new Error(tagAError?.message ?? "Missing tag A");
  ownTagId = tagA.id;

  const { data: tagB, error: tagBError } = await admin
    .from("tags")
    .insert({ user_id: userB.id, name: `other-tag-${testRunId}` })
    .select("id")
    .single();
  if (tagBError || !tagB) throw new Error(tagBError?.message ?? "Missing tag B");
  otherTagId = tagB.id;

  const { data: categoryB, error: categoryBError } = await admin
    .from("categories")
    .insert({ user_id: userB.id, name: `other-category-${testRunId}`, kind: "EXPENSE" })
    .select("id")
    .single();
  if (categoryBError || !categoryB) throw new Error(categoryBError?.message ?? "Missing category B");
  otherCategoryId = categoryB.id;

  userAClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await userAClient.auth.signInWithPassword({ email: userA.email, password: userA.password });
  if (signInError) throw new Error(signInError.message);
});

afterAll(async () => {
  await admin.from("profiles").delete().in("id", [userA?.id, userB?.id].filter(Boolean));
  await Promise.all([userA, userB].filter(Boolean).map((user) => admin.auth.admin.deleteUser(user.id)));
});

describe("category and tag ownership", () => {
  it("does not return another user's category or tag", async () => {
    const category = await userAClient.from("categories").select("id").eq("id", otherCategoryId);
    const tag = await userAClient.from("tags").select("id").eq("id", otherTagId);

    expect(category.error).toBeNull();
    expect(category.data).toEqual([]);
    expect(tag.error).toBeNull();
    expect(tag.data).toEqual([]);
  });

  it("does not allow deactivating another user's category even when the row filter is spoofed", async () => {
    const repository = createCategoryTagRepository(userAClient);

    await expect(repository.deactivateCategory(userB.id, otherCategoryId)).resolves.toBe(false);

    const { data } = await admin.from("categories").select("is_active").eq("id", otherCategoryId).single();
    expect(data?.is_active).toBe(true);
  });

  it("does not allow deactivating another user's tag even when the row filter is spoofed", async () => {
    const repository = createCategoryTagRepository(userAClient);

    await expect(repository.deactivateTag(userB.id, otherTagId)).resolves.toBe(false);

    const { data } = await admin.from("tags").select("is_active").eq("id", otherTagId).single();
    expect(data?.is_active).toBe(true);
  });

  it("does not allow assigning an owned tag to another user's transaction", async () => {
    const repository = createCategoryTagRepository(userAClient);

    await expect(repository.assignTag(userA.id, otherTransactionId, ownTagId)).resolves.toBe(false);

    const { data } = await admin.from("transaction_tags").select("transaction_id").eq("transaction_id", otherTransactionId);
    expect(data).toEqual([]);
  });

  it("does not allow assigning another user's tag to an owned transaction", async () => {
    const repository = createCategoryTagRepository(userAClient);

    await expect(repository.assignTag(userA.id, ownTransactionId, otherTagId)).resolves.toBe(false);

    const { data } = await admin.from("transaction_tags").select("tag_id").eq("transaction_id", ownTransactionId);
    expect(data).toEqual([]);
  });

  it("allows assigning an owned tag to an owned transaction", async () => {
    const repository = createCategoryTagRepository(userAClient);

    await expect(repository.assignTag(userA.id, ownTransactionId, ownTagId)).resolves.toBe(true);

    const { data } = await admin.from("transaction_tags").select("tag_id").eq("transaction_id", ownTransactionId);
    expect(data).toEqual([{ tag_id: ownTagId }]);
  });
});
