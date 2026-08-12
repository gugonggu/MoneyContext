import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

export async function deleteCurrentUserAccount(userId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
