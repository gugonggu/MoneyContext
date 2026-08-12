import "server-only";

import { createSupabaseServerClient } from "@/server/supabase/server";

import { createBackupRepository } from "./repository";
import { createBackupService } from "./service";

export async function generateBackupForCurrentUser(userId: string) {
  const supabase = await createSupabaseServerClient();
  return createBackupService(createBackupRepository(supabase)).generate(userId);
}

export async function restoreBackupForCurrentUser(userId: string, input: unknown): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await createBackupService(createBackupRepository(supabase)).restore(userId, input);
}

export { createBackupRepository } from "./repository";
export { createBackupService, type BackupReadData, type BackupRepository } from "./service";
