import "server-only";

import { createSupabaseServerClient } from "@/server/supabase/server";

import { createProfileRepository } from "./repository";
import { createProfileService } from "./service";

export async function updateEmergencyFundForCurrentUser(userId: string, amount: number | null): Promise<void> {
  const supabase = await createSupabaseServerClient();
  return createProfileService(createProfileRepository(supabase)).updateEmergencyFund(userId, amount);
}
