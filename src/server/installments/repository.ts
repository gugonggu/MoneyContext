import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createInstallmentSchedule } from "@/domain/cards/installments";
import type { InstallmentRepository } from "@/server/installments/service";

export function createInstallmentRepository(supabase: SupabaseClient): InstallmentRepository {
  return {
    async findAccount(userId, id) {
      const { data, error } = await supabase
        .from("accounts")
        .select("id,user_id,is_active,type")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, userId: data.user_id, isActive: data.is_active, type: data.type } : null;
    },
    async createPurchase(_userId, input) {
      const schedule = createInstallmentSchedule({
        totalAmount: input.amount,
        installmentCount: input.installmentCount,
        firstPaymentDate: input.firstPaymentDate,
        feeAmounts: input.feeAmounts,
      });

      const { data, error } = await supabase.rpc("create_installment_purchase", {
        input_purchase: {
          account_id: input.accountId,
          category_id: input.categoryId ?? null,
          transaction_at: input.transactionAt,
          amount: input.amount,
          memo: input.memo ?? null,
          installment_count: input.installmentCount,
          interest_type: input.interestType,
          start_month: `${input.firstPaymentDate.slice(0, 7)}-01`,
        },
        payment_schedule: schedule.map((row) => ({
          sequence: row.sequence,
          scheduled_date: row.scheduledDate,
          principal_amount: row.principalAmount,
          fee_amount: row.feeAmount,
        })),
      });
      if (error) throw new Error(error.message);
      return { planId: String(data) };
    },
    async settlePayment(_userId, input) {
      const { data, error } = await supabase.rpc("create_installment_settlement", {
        input_payment_id: input.paymentId,
        input_payment_account_id: input.paymentAccountId,
        input_transaction_at: input.transactionAt,
      });
      if (error) throw new Error(error.message);
      return { transferId: String(data) };
    },
  };
}
