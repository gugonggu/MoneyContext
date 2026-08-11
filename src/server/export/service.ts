import "server-only";

import { generateExportMarkdown, type ExportReadModel } from "@/domain/export/markdown";
import { generateAnalysisJson, type AnalysisJson } from "@/domain/export/analysis-json";
import { generateTransactionCsv } from "@/domain/export/csv";
import { resolveExportPeriod, type ExportPeriod, type ExportPeriodInput } from "@/domain/export/period";
import { isExportPreset, type ExportPreset } from "@/domain/export/presets";
import type { DataExportInput } from "./download";

export type ExportReadData = Omit<ExportReadModel, "generatedAt" | "period" | "preset">;

export interface ExportReadRepository {
  getReadData(userId: string, period: ExportPeriod): Promise<ExportReadData>;
}

export type MarkdownExportInput = Readonly<{
  preset: string;
  period?: ExportPeriodInput;
}>;

type MarkdownFormatter = (readModel: ExportReadModel) => string;

function exportReadModel(data: ExportReadData, period: ExportPeriod, preset: ExportPreset, now: Date): ExportReadModel {
  return {
    ...data,
    generatedAt: now.toISOString(),
    period,
    preset,
  };
}

export function createExportService(repository: ExportReadRepository, format: MarkdownFormatter = generateExportMarkdown) {
  return {
    async generateMarkdown(userId: string, input: MarkdownExportInput, now = new Date()): Promise<string> {
      if (!isExportPreset(input.preset)) throw new RangeError("unsupported export preset");
      const period = resolveExportPeriod(input.period, now);
      const data = await repository.getReadData(userId, period);
      return format(exportReadModel(data, period, input.preset as ExportPreset, now));
    },
    async generateAnalysisJson(userId: string, input: DataExportInput, now = new Date()): Promise<AnalysisJson> {
      const period = resolveExportPeriod(input.period, now);
      const data = await repository.getReadData(userId, period);
      return generateAnalysisJson(exportReadModel(data, period, "SPENDING_REVIEW", now));
    },
    async generateTransactionCsv(userId: string, input: DataExportInput, now = new Date()): Promise<string> {
      const period = resolveExportPeriod(input.period, now);
      const data = await repository.getReadData(userId, period);
      return generateTransactionCsv(exportReadModel(data, period, "SPENDING_REVIEW", now));
    },
  };
}
