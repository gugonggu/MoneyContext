import "server-only";

import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createTransactionRepository } from "@/server/transactions/repository";
import { createTransactionService } from "@/server/transactions/service";

import { createReconciliationRepository, createAssetReadRepository } from "./repository";
import { createReconciliationService, type ReconciliationInput } from "./reconciliation";
import { createAssetReadService } from "./service";

async function current() {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return { userId: profile.id, supabase };
}

export async function getAssetOverviewForCurrentUser() {
  const { userId, supabase } = await current();
  return createAssetReadService(createAssetReadRepository(supabase)).getOverview(userId);
}

export async function reconcileAccountForCurrentUser(input: ReconciliationInput) {
  const { userId, supabase } = await current();
  return createReconciliationService(createReconciliationRepository(supabase), createTransactionService(createTransactionRepository(supabase))).reconcileAccount(userId, input);
}
