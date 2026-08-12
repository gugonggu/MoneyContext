import "server-only";

import { timingSafeEqual } from "node:crypto";

import { hashInviteCode } from "@/server/auth/invite-hash";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export async function isInviteCodeValid(inviteCode: string): Promise<boolean> {
  const pepper = process.env.APP_INVITE_PEPPER;
  if (!pepper || !inviteCode.trim()) return false;

  const { data, error } = await createSupabaseAdminClient()
    .from("app_settings")
    .select("invite_code_hash, signup_enabled")
    .eq("signup_enabled", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;

  const expected = Buffer.from(data.invite_code_hash, "utf8");
  const actual = Buffer.from(hashInviteCode(inviteCode.trim(), pepper), "utf8");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
