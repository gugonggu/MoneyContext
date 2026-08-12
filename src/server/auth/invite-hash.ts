import "server-only";

import { createHash } from "node:crypto";

export function hashInviteCode(code: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}
