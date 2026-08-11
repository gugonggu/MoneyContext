import "server-only";

import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { createExportRepository } from "./repository";
import { createExportService, type MarkdownExportInput } from "./service";

export async function generateMarkdownExportForCurrentUser(input: MarkdownExportInput): Promise<string> {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return createExportService(createExportRepository(supabase)).generateMarkdown(profile.id, input);
}

export type { MarkdownExportInput } from "./service";
