import { AdminInviteSettings } from "@/components/settings/AdminInviteSettings";
import { BackupRestore } from "@/components/settings/BackupRestore";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireCurrentProfile } from "@/server/auth/require-profile";

export default async function SettingsPage() {
  const profile = await requireCurrentProfile();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="설정" description="설정 화면은 준비 중입니다." />
      <BackupRestore />
      {profile.role === "ADMIN" ? <AdminInviteSettings /> : null}
      <DeleteAccount />
    </div>
  );
}
