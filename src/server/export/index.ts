import "server-only";

import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

import type { AnalysisJson } from "@/domain/export/analysis-json";
import type { DataExportInput } from "./download";
import { createExportRepository } from "./repository";
import { createExportService, type MarkdownExportInput } from "./service";

export async function generateMarkdownExportForCurrentUser(input: MarkdownExportInput): Promise<string> {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return createExportService(createExportRepository(supabase)).generateMarkdown(profile.id, input);
}

export async function generateAnalysisJsonExport(userId: string, input: DataExportInput): Promise<AnalysisJson> {
  const supabase = await createSupabaseServerClient();
  return createExportService(createExportRepository(supabase)).generateAnalysisJson(userId, input);
}

export async function generateTransactionCsvExport(userId: string, input: DataExportInput): Promise<string> {
  const supabase = await createSupabaseServerClient();
  return createExportService(createExportRepository(supabase)).generateTransactionCsv(userId, input);
}

export type { DataExportInput } from "./download";
export type { MarkdownExportInput } from "./service";
