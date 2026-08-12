import "server-only";

import { remapBackup } from "@/domain/backup/remap";
import { BACKUP_SCHEMA, BACKUP_SCHEMA_VERSION, BACKUP_TIMEZONE, type BackupPayload } from "@/domain/backup/schema";
import { parseBackup } from "@/domain/backup/validate";

export type BackupReadData = Omit<BackupPayload, "metadata">;

export interface BackupRepository {
  getBackupData(userId: string): Promise<BackupReadData>;
  restoreBackup(userId: string, payload: BackupPayload): Promise<void>;
}

const MAX_CONSISTENCY_READS = 3;

function payload(data: BackupReadData, exportedAt: Date): BackupPayload {
  return parseBackup({
    metadata: {
      schema: BACKUP_SCHEMA,
      schema_version: BACKUP_SCHEMA_VERSION,
      exported_at: exportedAt.toISOString(),
      base_currency: data.profile.base_currency,
      timezone: BACKUP_TIMEZONE,
    },
    ...data,
  });
}

function validateGraph(backup: BackupPayload, userId: string): void {
  let id = 0;
  remapBackup(backup, userId, () => `backup-export-validation-${id++}`);
}

export function createBackupService(repository: BackupRepository) {
  return {
    async generate(userId: string, exportedAt = new Date()): Promise<BackupPayload> {
      let previousJson: string | undefined;
      for (let read = 0; read < MAX_CONSISTENCY_READS; read += 1) {
        const current = payload(await repository.getBackupData(userId), exportedAt);
        try {
          validateGraph(current, userId);
        } catch (error) {
          if (error instanceof RangeError && error.message.includes("outside the backup graph")) {
            previousJson = undefined;
            continue;
          }
          throw error;
        }
        const currentJson = JSON.stringify(current);
        if (currentJson === previousJson) return current;
        previousJson = currentJson;
      }
      throw new Error("backup data changed during export");
    },
    async restore(userId: string, input: unknown): Promise<void> {
      const { payload: remapped } = remapBackup(input, userId);
      await repository.restoreBackup(userId, remapped);
    },
  };
}
