"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";

const RESTORE_SUCCESS_FRAGMENT = "#backup-restored";
const RESTORE_SUCCESS_MESSAGE = "Backup restored. Your financial data has been refreshed.";

function subscribeToRestoreFragment(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

function hasRestoreFragment(): boolean {
  return window.location.hash === RESTORE_SUCCESS_FRAGMENT;
}

function noRestoreFragmentOnServer(): boolean {
  return false;
}

export function BackupRestore() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<Readonly<{ kind: "error" | "success"; text: string }> | null>(null);
  const hasRestoreSuccess = useSyncExternalStore(subscribeToRestoreFragment, hasRestoreFragment, noRestoreFragmentOnServer);

  useEffect(() => {
    if (!hasRestoreSuccess) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [hasRestoreSuccess]);

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setIsConfirmed(false);
    setMessage(null);
  }

  async function restore() {
    if (!file || !isConfirmed || isRestoring) return;

    setIsRestoring(true);
    setMessage(null);
    try {
      const backup = JSON.parse(await file.text());
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(backup),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Unable to restore backup. Please try again.");
      }

      setFile(null);
      setIsConfirmed(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage({ kind: "success", text: RESTORE_SUCCESS_MESSAGE });
      window.location.hash = RESTORE_SUCCESS_FRAGMENT;
      window.location.reload();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof SyntaxError ? "The selected file is not valid JSON." : error instanceof Error ? error.message : "Unable to restore backup. Please try again.",
      });
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <section aria-labelledby="backup-restore-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="backup-restore-heading" className="text-lg font-semibold text-content-primary">
          Backup and restore
        </h2>
        <p className="mt-1 text-sm text-content-muted">Download a complete copy of your financial data, or restore a previously downloaded backup.</p>
      </div>

      <Card className="flex flex-col gap-4">
        <a
          href="/api/backup"
          download
          className="inline-flex w-fit items-center gap-1.5 rounded-tile border border-border-strong bg-surface-raised px-4 py-2 text-sm font-semibold text-content-secondary shadow-card transition-colors hover:bg-surface-base"
        >
          Download full backup
        </a>

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
          <h3 className="text-sm font-semibold text-content-primary">Restore from backup</h3>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-content-secondary">
            Choose a JSON backup file
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={selectFile}
              className="text-sm text-content-secondary file:mr-3 file:rounded-tile file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
            />
          </label>

          {file ? (
            <div className="flex flex-col gap-3 rounded-tile border border-border-subtle bg-surface-base p-3">
              <p className="text-sm font-medium text-content-secondary">{file.name}</p>
              <p role="status" aria-live="polite" aria-label="Restore replacement warning" className="text-sm text-content-secondary">
                Restoring this backup will replace your current financial data. This cannot be undone.
              </p>
              <Checkbox
                label="I understand that restoring replaces my current financial data"
                checked={isConfirmed}
                onChange={(event) => setIsConfirmed(event.target.checked)}
              />
              <Button variant="danger" type="button" disabled={!isConfirmed || isRestoring} onClick={restore} className="self-start">
                {isRestoring ? "Restoring backup..." : "Restore backup"}
              </Button>
            </div>
          ) : null}
        </div>

        {message || hasRestoreSuccess ? (
          <Alert
            kind={message?.kind === "error" ? "error" : "success"}
            role={message?.kind === "error" ? "alert" : "status"}
            aria-label={message?.kind === "error" ? "Restore error" : undefined}
          >
            {message?.text ?? RESTORE_SUCCESS_MESSAGE}
          </Alert>
        ) : null}
      </Card>
    </section>
  );
}
