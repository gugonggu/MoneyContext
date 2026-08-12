import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createInviteSettingsRepository } from "@/server/admin/invite-settings/repository";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const admin = createSupabaseAdminClient();

type AppSettingsRow = { id: string; invite_code_hash: string; signup_enabled: boolean; created_at: string; updated_at: string };

let originalRow: AppSettingsRow | null = null;

async function clearAppSettings(): Promise<void> {
  const { error } = await admin.from("app_settings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
}

async function restoreOriginalRow(): Promise<void> {
  await clearAppSettings();
  if (!originalRow) return;
  const { error } = await admin.from("app_settings").insert(originalRow);
  if (error) throw new Error(error.message);
}

beforeAll(async () => {
  // This table is a real singleton row in the shared Supabase project (the
  // live invite code / signup toggle), not test fixture data - snapshot it
  // so it can be restored exactly, rather than letting these tests
  // permanently delete production invite configuration.
  const { data, error } = await admin.from("app_settings").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  originalRow = data as AppSettingsRow | null;
});

beforeEach(clearAppSettings);
afterAll(restoreOriginalRow);

describe("invite settings repository", () => {
  it("getStatus returns null when no row exists", async () => {
    const repository = createInviteSettingsRepository(admin);
    await expect(repository.getStatus()).resolves.toBeNull();
  });

  it("rotateInviteCode inserts a row with signup enabled by default when none exists", async () => {
    const repository = createInviteSettingsRepository(admin);
    await repository.rotateInviteCode("hash-1");

    const { data, error } = await admin.from("app_settings").select("invite_code_hash, signup_enabled").single();
    if (error) throw new Error(error.message);
    expect(data).toEqual({ invite_code_hash: "hash-1", signup_enabled: true });
  });

  it("rotateInviteCode updates the existing row's hash without changing signup_enabled", async () => {
    const repository = createInviteSettingsRepository(admin);
    await repository.rotateInviteCode("hash-1");
    await repository.setSignupEnabled(false);
    await repository.rotateInviteCode("hash-2");

    const { data, error } = await admin.from("app_settings").select("invite_code_hash, signup_enabled").single();
    if (error) throw new Error(error.message);
    expect(data).toEqual({ invite_code_hash: "hash-2", signup_enabled: false });

    const { count } = await admin.from("app_settings").select("id", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("setSignupEnabled toggles the existing row", async () => {
    const repository = createInviteSettingsRepository(admin);
    await repository.rotateInviteCode("hash-1");
    await repository.setSignupEnabled(false);

    await expect(repository.getStatus()).resolves.toEqual({ signupEnabled: false });
  });
});
