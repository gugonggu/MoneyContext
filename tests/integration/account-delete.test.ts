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

beforeAll(async () => {
  user = await createTestUser();
  const { error } = await admin.from("profiles").insert({ id: user.id, display_name: "Account Delete User", salary_cycle_day: 1, base_currency: "KRW" });
  if (error) throw new Error(error.message);
  const { error: accountError } = await admin.from("accounts").insert({ user_id: user.id, name: "account delete test account", type: "CASH" });
  if (accountError) throw new Error(accountError.message);
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

    const { data: authUser } = await admin.auth.admin.getUserById(user.id);
    expect(authUser.user).toBeNull();
  });
});
