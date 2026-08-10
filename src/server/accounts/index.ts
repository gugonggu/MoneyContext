import "server-only";

import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createAccountRepository } from "@/server/accounts/repository";
import { createAccountService, type CreateAccountInput, type CreateCreditCardSettingsInput, type UpdateAccountInput } from "@/server/accounts/service";
import { createSupabaseServerClient } from "@/server/supabase/server";

async function serviceForCurrentUser() {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return { userId: profile.id, service: createAccountService(createAccountRepository(supabase)) };
}

export async function listAccountsForCurrentUser(activeOnly = true) {
  const { userId, service } = await serviceForCurrentUser();
  return service.list(userId, activeOnly);
}

export async function createAccountForCurrentUser(input: CreateAccountInput) {
  const { userId, service } = await serviceForCurrentUser();
  return service.create(userId, input);
}

export async function updateAccountForCurrentUser(accountId: string, input: UpdateAccountInput) {
  const { userId, service } = await serviceForCurrentUser();
  return service.update(userId, accountId, input);
}

export async function deactivateAccountForCurrentUser(accountId: string) {
  const { userId, service } = await serviceForCurrentUser();
  return service.deactivate(userId, accountId);
}

export async function createCreditCardSettingsForCurrentUser(input: CreateCreditCardSettingsInput) {
  const { userId, service } = await serviceForCurrentUser();
  return service.createCreditCardSettings(userId, input);
}
