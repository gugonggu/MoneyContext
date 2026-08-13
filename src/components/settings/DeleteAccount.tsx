"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function DeleteAccount() {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "계정을 삭제하지 못했습니다. 다시 시도해주세요.");
      }

      await createSupabaseBrowserClient().auth.signOut();
      // Full navigation, not router.push: the account no longer exists, so every
      // cached client/RSC state for this session must be discarded, not reused.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/invite";
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "계정을 삭제하지 못했습니다. 다시 시도해주세요.");
      setIsDeleting(false);
    }
  }

  return (
    <section aria-labelledby="delete-account-heading" className="flex flex-col gap-4">
      <h2 id="delete-account-heading" className="text-lg font-semibold text-content-primary">
        계정 삭제
      </h2>

      <Card variant="glass" className="flex flex-col gap-3 border-negative-200 dark:border-negative-500/30">
        <p role="status" aria-live="polite" aria-label="계정 삭제 경고" className="text-sm text-content-secondary">
          계정을 삭제하면 모든 금융 데이터가 영구적으로 사라집니다. 되돌릴 수 없어요.
        </p>
        <p className="text-sm text-content-secondary">
          삭제 전{" "}
          <a href="/api/backup" download className="font-medium text-brand-600 underline hover:text-brand-700">
            전체 백업을 내려받는 것
          </a>
          을 권장해요.
        </p>

        <Checkbox
          label="계정과 모든 금융 데이터가 영구적으로 삭제된다는 것을 이해했습니다"
          checked={isConfirmed}
          onChange={(event) => setIsConfirmed(event.target.checked)}
        />
        <Button variant="danger" type="button" disabled={!isConfirmed || isDeleting} onClick={deleteAccount} className="self-start">
          {isDeleting ? "계정 삭제 중..." : "계정 삭제"}
        </Button>

        {error ? (
          <Alert kind="error" role="alert" aria-label="계정 삭제 오류">
            {error}
          </Alert>
        ) : null}
      </Card>
    </section>
  );
}
