"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";

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
      <Alert kind={message.kind === "error" ? "error" : "success"} role={message.kind === "error" ? "alert" : "status"} aria-label={message.kind === "error" ? "Invite settings error" : undefined}>
        {message.text}
      </Alert>
    ) : null;
  }

  return (
    <section aria-labelledby="admin-invite-settings-heading" className="flex flex-col gap-4">
      <h2 id="admin-invite-settings-heading" className="text-lg font-semibold text-slate-900">
        Invite settings
      </h2>

      <Card className="flex flex-col gap-4">
        <Checkbox
          label="Signup enabled"
          checked={status.signupEnabled}
          disabled={isBusy || !status.hasInviteCode}
          onChange={(event) => toggleSignup(event.target.checked)}
        />
        {!status.hasInviteCode ? <p className="text-sm text-slate-600">Generate an invite code below before enabling signup.</p> : null}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Rotate invite code</h3>
          <Checkbox
            label="I understand the previous invite code will stop working for new signups"
            checked={isConfirmed}
            onChange={(event) => setIsConfirmed(event.target.checked)}
          />
          <Button variant="primary" type="button" disabled={!isConfirmed || isBusy} onClick={rotate} className="self-start">
            Generate new invite code
          </Button>
        </div>

        {rotatedCode ? (
          <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
            <p role="status" className="text-sm text-brand-700">
              New invite code: <code className="ml-1 rounded bg-white px-2 py-1 font-mono text-sm text-slate-900">{rotatedCode}</code>. Copy it now — it
              will not be shown again.
            </p>
          </div>
        ) : null}

        {message ? (
          <Alert kind={message.kind === "error" ? "error" : "success"} role={message.kind === "error" ? "alert" : "status"} aria-label={message.kind === "error" ? "Invite settings error" : undefined}>
            {message.text}
          </Alert>
        ) : null}
      </Card>
    </section>
  );
}
