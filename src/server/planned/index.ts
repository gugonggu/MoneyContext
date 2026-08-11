import "server-only";

import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createPlannedRepository } from "@/server/planned/repository";
import {
  createPlannedTransactionService,
  type PlannedTransactionInput,
} from "@/server/planned/service";
import { createSupabaseServerClient } from "@/server/supabase/server";

async function current() {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return { userId: profile.id, service: createPlannedTransactionService(createPlannedRepository(supabase)) };
}

export async function listPlannedTransactionsForCurrentUser() {
  const { userId, service } = await current();
  return service.list(userId);
}

export async function createPlannedTransactionForCurrentUser(input: PlannedTransactionInput) {
  const { userId, service } = await current();
  return service.create(userId, input);
}

export async function updatePlannedTransactionForCurrentUser(id: string, input: PlannedTransactionInput) {
  const { userId, service } = await current();
  return service.update(userId, id, input);
}

export async function removePlannedTransactionForCurrentUser(id: string) {
  const { userId, service } = await current();
  return service.remove(userId, id);
}

export async function confirmPlannedTransactionForCurrentUser(id: string) {
  const { userId, service } = await current();
  return service.confirm(userId, id);
}
