import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const inviteSessionTtlMs = 10 * 60 * 1000;

function signingKey(): string {
  const pepper = process.env.APP_INVITE_PEPPER;
  if (!pepper) throw new Error("Missing required environment variable: APP_INVITE_PEPPER");
  return pepper;
}

// `valid` records whether the invite code the user typed before starting Google
// sign-in matched the signup code. Login never needs the code, so this is only
// consulted by /auth/callback when it turns out to be a brand-new profile.
export function createInviteSession(valid: boolean): string {
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + inviteSessionTtlMs, valid })).toString("base64url");
  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function isInviteSessionValid(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { expiresAt?: unknown; valid?: unknown };
    return typeof decoded.expiresAt === "number" && decoded.expiresAt > Date.now() && decoded.valid === true;
  } catch {
    return false;
  }
}
