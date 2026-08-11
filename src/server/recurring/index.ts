import "server-only";

import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createRecurringRepository } from "@/server/recurring/repository";
import {
  createRecurringTransactionService,
  type RecurringInput,
} from "@/server/recurring/service";
import { createSupabaseServerClient } from "@/server/supabase/server";

async function current() {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return { userId: profile.id, service: createRecurringTransactionService(createRecurringRepository(supabase)) };
}

export async function createRecurringRuleForCurrentUser(input: RecurringInput) {
  const { userId, service } = await current();
  return service.create(userId, input);
}

export async function listRecurringRulesForCurrentUser() {
  const { userId, service } = await current();
  return service.list(userId);
}

export async function updateRecurringRuleForCurrentUser(id: string, input: RecurringInput) {
  const { userId, service } = await current();
  return service.update(userId, id, input);
}

export async function deactivateRecurringRuleForCurrentUser(id: string) {
  const { userId, service } = await current();
  return service.deactivate(userId, id);
}

export async function generateDueRecurringTransactionsForCurrentUser(today: string) {
  const { userId, service } = await current();
  return service.generateDue(userId, today);
}
