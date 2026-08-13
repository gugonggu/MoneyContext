import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

import { getSupabasePublicConfig } from "../../../src/lib/supabase/config";

export type E2EUser = Readonly<{ id: string; email: string; password: string }>;

function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  return key;
}

function adminClient(): SupabaseClient {
  const { url } = getSupabasePublicConfig();
  return createClient(url, requireServiceRoleKey(), { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function createE2EUser(label: string): Promise<E2EUser> {
  const admin = adminClient();
  const testRunId = randomUUID();
  const email = `money-context-e2e-${label}-${testRunId}@example.test`;
  const password = `E2ETest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? `Unable to create e2e test user (${label})`);

  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, display_name: `E2E ${label}`, salary_cycle_day: 1, base_currency: "KRW" });
  if (profileError) throw new Error(profileError.message);

  return { id: data.user.id, email, password };
}

export async function deleteE2EUser(user: E2EUser): Promise<void> {
  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) throw new Error(`Unable to delete e2e test user (${user.email}): ${error.message}`);
}

export async function signInAsE2EUser(page: Page, user: E2EUser): Promise<void> {
  const { url, anonKey } = getSupabasePublicConfig();
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error || !data.session) throw new Error(error?.message ?? `Unable to sign in e2e test user (${user.email})`);

  const response = await page.request.post("/api/test/session", {
    data: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token },
  });
  if (!response.ok()) throw new Error(`Unable to bootstrap e2e session for ${user.email}: ${response.status()}`);
}
