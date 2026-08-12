import { AdminInviteSettings } from "@/components/settings/AdminInviteSettings";
import { BackupRestore } from "@/components/settings/BackupRestore";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { requireCurrentProfile } from "@/server/auth/require-profile";

export default async function SettingsPage() {
  const profile = await requireCurrentProfile();

  return (
    <div>
      <h1>설정</h1>
      <p>설정 화면은 준비 중입니다.</p>
      <BackupRestore />
      {profile.role === "ADMIN" ? <AdminInviteSettings /> : null}
      <DeleteAccount />
    </div>
  );
}
