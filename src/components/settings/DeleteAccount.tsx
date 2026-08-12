"use client";

import { useState } from "react";

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
    <section aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading">Delete account</h2>
      <p role="status" aria-live="polite" aria-label="Delete account warning">
        Deleting your account permanently removes all your financial data. This cannot be undone.
      </p>
      <p>
        Consider <a href="/api/backup" download>downloading a full backup</a> first.
      </p>

      <label>
        <input type="checkbox" checked={isConfirmed} onChange={(event) => setIsConfirmed(event.target.checked)} />
        I understand this will permanently delete my account and all my financial data
      </label>
      <button type="button" disabled={!isConfirmed || isDeleting} onClick={deleteAccount}>
        {isDeleting ? "Deleting account..." : "Delete account"}
      </button>

      {error ? (
        <p role="alert" aria-label="Delete account error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
