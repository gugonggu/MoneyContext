import { randomBytes } from "node:crypto";

import { NoInviteCodeError } from "@/server/admin/invite-settings/errors";
import { hashInviteCode } from "@/server/auth/invite-hash";

export type InviteSettingsRepository = Readonly<{
  getStatus(): Promise<{ signupEnabled: boolean } | null>;
  rotateInviteCode(hash: string): Promise<void>;
  setSignupEnabled(enabled: boolean): Promise<void>;
}>;

export type InviteSettingsService = Readonly<{
  getStatus(): Promise<{ signupEnabled: boolean; hasInviteCode: boolean }>;
  rotate(): Promise<{ inviteCode: string }>;
  setSignupEnabled(enabled: boolean): Promise<void>;
}>;

function defaultGenerateCode(): string {
  return randomBytes(18).toString("base64url");
}

export function createInviteSettingsService(
  repository: InviteSettingsRepository,
  options: Readonly<{ pepper: string; generateCode?: () => string }>,
): InviteSettingsService {
  const generateCode = options.generateCode ?? defaultGenerateCode;

  return {
    async getStatus() {
      const status = await repository.getStatus();
      return { signupEnabled: status?.signupEnabled ?? false, hasInviteCode: status !== null };
    },

    async rotate() {
      const inviteCode = generateCode();
      await repository.rotateInviteCode(hashInviteCode(inviteCode, options.pepper));
      return { inviteCode };
    },

    async setSignupEnabled(enabled: boolean) {
      const status = await repository.getStatus();
      if (status === null) throw new NoInviteCodeError();
      await repository.setSignupEnabled(enabled);
    },
  };
}
