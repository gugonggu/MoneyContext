import "server-only";

import { generateExportMarkdown, type ExportReadModel } from "@/domain/export/markdown";
import { resolveExportPeriod, type ExportPeriod, type ExportPeriodInput } from "@/domain/export/period";
import { isExportPreset, type ExportPreset } from "@/domain/export/presets";

export type ExportReadData = Omit<ExportReadModel, "generatedAt" | "period" | "preset">;

export interface ExportReadRepository {
  getReadData(userId: string, period: ExportPeriod): Promise<ExportReadData>;
}

export type MarkdownExportInput = Readonly<{
  preset: string;
  period?: ExportPeriodInput;
}>;

type ExportFormatter = (readModel: ExportReadModel) => string;

export function createExportService(repository: ExportReadRepository, format: ExportFormatter = generateExportMarkdown) {
  return {
    async generateMarkdown(userId: string, input: MarkdownExportInput, now = new Date()): Promise<string> {
      if (!isExportPreset(input.preset)) throw new RangeError("unsupported export preset");
      const period = resolveExportPeriod(input.period, now);
      const data = await repository.getReadData(userId, period);
      return format({
        ...data,
        generatedAt: now.toISOString(),
        period,
        preset: input.preset as ExportPreset,
      });
    },
  };
}
