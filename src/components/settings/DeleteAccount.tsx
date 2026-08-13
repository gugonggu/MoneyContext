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
        throw new Error(typeof body?.error === "string" ? body.error : "Unable to delete account. Please try again.");
      }

      await createSupabaseBrowserClient().auth.signOut();
      // Full navigation, not router.push: the account no longer exists, so every
      // cached client/RSC state for this session must be discarded, not reused.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/invite";
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete account. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <section aria-labelledby="delete-account-heading" className="flex flex-col gap-4">
      <h2 id="delete-account-heading" className="text-lg font-semibold text-content-primary">
        Delete account
      </h2>

      <Card className="flex flex-col gap-3 border-negative-100">
        <p role="status" aria-live="polite" aria-label="Delete account warning" className="text-sm text-content-secondary">
          Deleting your account permanently removes all your financial data. This cannot be undone.
        </p>
        <p className="text-sm text-content-secondary">
          Consider{" "}
          <a href="/api/backup" download className="font-medium text-brand-600 underline hover:text-brand-700">
            downloading a full backup
          </a>{" "}
          first.
        </p>

        <Checkbox
          label="I understand this will permanently delete my account and all my financial data"
          checked={isConfirmed}
          onChange={(event) => setIsConfirmed(event.target.checked)}
        />
        <Button variant="danger" type="button" disabled={!isConfirmed || isDeleting} onClick={deleteAccount} className="self-start">
          {isDeleting ? "Deleting account..." : "Delete account"}
        </Button>

        {error ? (
          <Alert kind="error" role="alert" aria-label="Delete account error">
            {error}
          </Alert>
        ) : null}
      </Card>
    </section>
  );
}
