"use client";

import { useEffect, useState } from "react";

type Status = Readonly<{ signupEnabled: boolean; hasInviteCode: boolean }>;
type Message = Readonly<{ kind: "error" | "success"; text: string }>;

export function AdminInviteSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [rotatedCode, setRotatedCode] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/invite-settings")
      .then((response) => response.json())
      .then(setStatus)
      .catch(() => setMessage({ kind: "error", text: "Unable to load invite settings." }));
  }, []);

  async function rotate() {
    if (!isConfirmed || isBusy) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/invite-settings/rotate", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "Unable to rotate invite code");
      setRotatedCode(body.inviteCode);
      setIsConfirmed(false);
      setStatus((current) => (current ? { ...current, hasInviteCode: true } : current));
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to rotate invite code" });
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleSignup(enabled: boolean) {
    setIsBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/invite-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signupEnabled: enabled }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Unable to update signup setting");
      }
      setStatus((current) => (current ? { ...current, signupEnabled: enabled } : current));
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to update signup setting" });
    } finally {
      setIsBusy(false);
    }
  }

  if (!status) {
    return message ? (
      <p role={message.kind === "error" ? "alert" : "status"} aria-label={message.kind === "error" ? "Invite settings error" : undefined}>
        {message.text}
      </p>
    ) : null;
  }

  return (
    <section aria-labelledby="admin-invite-settings-heading">
      <h2 id="admin-invite-settings-heading">Invite settings</h2>

      <label>
        Signup enabled
        <input type="checkbox" checked={status.signupEnabled} disabled={isBusy} onChange={(event) => toggleSignup(event.target.checked)} />
      </label>

      <div>
        <h3>Rotate invite code</h3>
        <label>
          <input type="checkbox" checked={isConfirmed} onChange={(event) => setIsConfirmed(event.target.checked)} />
          I understand the previous invite code will stop working
        </label>
        <button type="button" disabled={!isConfirmed || isBusy} onClick={rotate}>
          Generate new invite code
        </button>
      </div>

      {rotatedCode ? (
        <p role="status">
          New invite code: <code>{rotatedCode}</code>. Copy it now — it will not be shown again.
        </p>
      ) : null}

      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} aria-label={message.kind === "error" ? "Invite settings error" : undefined}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
