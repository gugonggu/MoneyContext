import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfileRepository } from "./service";

export function createProfileRepository(supabase: SupabaseClient): ProfileRepository {
  return {
    async updateEmergencyFund(userId, amount) {
      const { error } = await supabase.from("profiles").update({ emergency_fund_amount: amount }).eq("id", userId);
      if (error) throw new Error(error.message);
    },
  };
}
