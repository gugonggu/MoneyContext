"use client";

import { useRef, useState } from "react";

export function BackupRestore() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<Readonly<{ kind: "error" | "success"; text: string }> | null>(null);

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
      setMessage({ kind: "success", text: "Backup restored. Your financial data has been refreshed." });
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
    <section aria-labelledby="backup-restore-heading">
      <h2 id="backup-restore-heading">Backup and restore</h2>
      <p>Download a complete copy of your financial data, or restore a previously downloaded backup.</p>

      <a href="/api/backup" download>
        Download full backup
      </a>

      <div>
        <h3>Restore from backup</h3>
        <label>
          Choose a JSON backup file
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={selectFile} />
        </label>

        {file ? (
          <>
            <p>{file.name}</p>
            <p role="status" aria-live="polite" aria-label="Restore replacement warning">Restoring this backup will replace your current financial data. This cannot be undone.</p>
            <label>
              <input type="checkbox" checked={isConfirmed} onChange={(event) => setIsConfirmed(event.target.checked)} />
              I understand that restoring replaces my current financial data
            </label>
            <button type="button" disabled={!isConfirmed || isRestoring} onClick={restore}>
              {isRestoring ? "Restoring backup..." : "Restore backup"}
            </button>
          </>
        ) : null}
      </div>

      {message ? <p role={message.kind === "error" ? "alert" : "status"} aria-label={message.kind === "error" ? "Restore error" : undefined}>{message.text}</p> : null}
    </section>
  );
}
