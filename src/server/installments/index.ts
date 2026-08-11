import "server-only";

import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createInstallmentRepository } from "@/server/installments/repository";
import {
  createInstallmentService,
  type InstallmentPurchaseInput,
  type InstallmentSettlementInput,
} from "@/server/installments/service";
import { createSupabaseServerClient } from "@/server/supabase/server";

async function current() {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return { userId: profile.id, service: createInstallmentService(createInstallmentRepository(supabase)) };
}

export async function createInstallmentPurchaseForCurrentUser(input: InstallmentPurchaseInput) {
  const { userId, service } = await current();
  return service.createPurchase(userId, input);
}

export async function settleInstallmentPaymentForCurrentUser(input: InstallmentSettlementInput) {
  const { userId, service } = await current();
  return service.settlePayment(userId, input);
}
