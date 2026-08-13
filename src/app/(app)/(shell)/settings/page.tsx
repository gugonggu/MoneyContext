import Link from "next/link";

import { BackupRestore } from "@/components/settings/BackupRestore";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireCurrentProfile } from "@/server/auth/require-profile";

export default async function SettingsPage() {
  const profile = await requireCurrentProfile();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="설정" description="백업, 복원, 계정 관리를 여기서 할 수 있어요." />

      {!profile.onboarding_completed ? (
        <section aria-labelledby="resume-onboarding-heading" className="flex flex-col gap-4">
          <h2 id="resume-onboarding-heading" className="text-lg font-semibold text-content-primary">
            초기 설정
          </h2>
          <Card variant="glass" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-content-secondary">이름, 급여일, 첫 계좌를 아직 등록하지 않았어요.</p>
            <Link
              href="/onboarding"
              className="inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-tile bg-gradient-to-br from-brand-600 to-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-card no-underline transition-colors hover:from-brand-700 hover:to-brand-600"
            >
              온보딩 시작하기
            </Link>
          </Card>
        </section>
      ) : null}

      <BackupRestore />
      <DeleteAccount />
    </div>
  );
}
