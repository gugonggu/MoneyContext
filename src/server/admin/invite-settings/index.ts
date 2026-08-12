import "server-only";

import { createInviteSettingsRepository } from "@/server/admin/invite-settings/repository";
import { createInviteSettingsService } from "@/server/admin/invite-settings/service";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

function getPepper(): string {
  const pepper = process.env.APP_INVITE_PEPPER;
  if (!pepper) throw new Error("Missing required environment variable: APP_INVITE_PEPPER");
  return pepper;
}

function service() {
  return createInviteSettingsService(createInviteSettingsRepository(createSupabaseAdminClient()), { pepper: getPepper() });
}

export function getInviteSettingsStatus() {
  return service().getStatus();
}

export function rotateInviteCodeForAdmin() {
  return service().rotate();
}

export function setSignupEnabledForAdmin(enabled: boolean) {
  return service().setSignupEnabled(enabled);
}
