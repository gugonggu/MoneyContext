import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { InviteSettingsRepository } from "@/server/admin/invite-settings/service";

export function createInviteSettingsRepository(client: SupabaseClient): InviteSettingsRepository {
  async function currentRowId(): Promise<string | null> {
    const { data, error } = await client.from("app_settings").select("id").limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.id ?? null;
  }

  return {
    async getStatus() {
      const { data, error } = await client.from("app_settings").select("signup_enabled").limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { signupEnabled: data.signup_enabled } : null;
    },

    async rotateInviteCode(hash) {
      const id = await currentRowId();
      if (id === null) {
        const { error } = await client.from("app_settings").insert({ invite_code_hash: hash, signup_enabled: true });
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await client.from("app_settings").update({ invite_code_hash: hash }).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async setSignupEnabled(enabled) {
      const id = await currentRowId();
      if (id === null) throw new Error("No app_settings row exists");
      const { error } = await client.from("app_settings").update({ signup_enabled: enabled }).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
