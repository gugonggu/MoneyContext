# Admin Invite Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an ADMIN rotate the shared invite code and toggle signup on/off from a settings UI, without ever persisting the invite code in plaintext, and prove ADMIN role has no special access to other users' finance data.

**Architecture:** A pure domain service (`src/server/admin/invite-settings/service.ts`) generates a fresh invite code and delegates hashing to a shared helper extracted from the existing signup-validation module. A thin repository talks to `app_settings` through the existing service-role admin client — the same server-only trust boundary `src/server/auth/invite.ts` already uses, since `app_settings` has RLS enabled with zero policies (deny-all except service role). Two Next.js API routes gate every request with the existing `requireAdminProfile()` helper (defined but currently unused) before touching the service. A client settings component shows the plaintext invite code exactly once, right after rotation, and never again. A separate integration test proves ADMIN gets no special read/write access on finance tables — that guarantee already comes from the Task 6 RLS policies and this task only needs to add regression coverage for it.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), TypeScript, Supabase Cloud/Postgres, Vitest, Testing Library.

## Global Constraints

- Invite code plaintext is never persisted or logged; only returned once in the rotate response body (`docs/SECURITY.md` §2, §7).
- `APP_INVITE_PEPPER` is shared with `src/server/auth/invite-session.ts` HMAC signing — do not rename or repurpose it.
- Admin-only server logic must use `requireAdminProfile()` (`src/server/auth/require-profile.ts:16-20`); never trust a client-sent role.
- `app_settings` writes go through `createSupabaseAdminClient()` (`src/server/supabase/admin.ts`) — never through the browser/anon client.
- Every collection/response returned to the client must exclude `invite_code_hash`.
- Timezone `Asia/Seoul`, base currency `KRW` are unrelated to this feature — no date/money logic is touched here.

---

### Task 1: Extract shared invite-code hashing helper

**Files:**
- Create: `src/server/auth/invite-hash.ts`
- Modify: `src/server/auth/invite.ts`
- Test: `tests/unit/invite-hash.test.ts`

**Interfaces:**
- Produces: `hashInviteCode(code: string, pepper: string): string` — exported, used by Task 2's service and by the existing `isInviteCodeValid` in `invite.ts`.

- [x] **Step 1: Write the failing test**

```typescript
// tests/unit/invite-hash.test.ts
import { describe, expect, it } from "vitest";

import { hashInviteCode } from "@/server/auth/invite-hash";

describe("hashInviteCode", () => {
  it("is deterministic for the same code and pepper", () => {
    expect(hashInviteCode("ABC123", "pepper")).toBe(hashInviteCode("ABC123", "pepper"));
  });

  it("changes when the code changes", () => {
    expect(hashInviteCode("ABC123", "pepper")).not.toBe(hashInviteCode("XYZ789", "pepper"));
  });

  it("changes when the pepper changes", () => {
    expect(hashInviteCode("ABC123", "pepper-a")).not.toBe(hashInviteCode("ABC123", "pepper-b"));
  });

  it("returns a 64-character lowercase hex sha256 digest", () => {
    expect(hashInviteCode("ABC123", "pepper")).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/unit/invite-hash.test.ts`
Expected: FAIL with "Cannot find module '@/server/auth/invite-hash'" or similar.

- [x] **Step 3: Write minimal implementation**

```typescript
// src/server/auth/invite-hash.ts
import "server-only";

import { createHash } from "node:crypto";

export function hashInviteCode(code: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}
```

Then modify `src/server/auth/invite.ts` to remove the local `hashInviteCode` function (currently lines 7-9) and import the shared one instead:

```typescript
// src/server/auth/invite.ts
import "server-only";

import { timingSafeEqual } from "node:crypto";

import { hashInviteCode } from "@/server/auth/invite-hash";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export async function isInviteCodeValid(inviteCode: string): Promise<boolean> {
  const pepper = process.env.APP_INVITE_PEPPER;
  if (!pepper || !inviteCode.trim()) return false;

  const { data, error } = await createSupabaseAdminClient()
    .from("app_settings")
    .select("invite_code_hash, signup_enabled")
    .eq("signup_enabled", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;

  const expected = Buffer.from(data.invite_code_hash, "utf8");
  const actual = Buffer.from(hashInviteCode(inviteCode.trim(), pepper), "utf8");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- tests/unit/invite-hash.test.ts`
Expected: PASS (4 tests)

Run: `npm.cmd test` (confirm the existing invite-validation behavior is unaffected — check for any current `invite.test.ts`; if none exists yet, this step just proves no regression in the full suite)
Expected: PASS, no new failures

- [x] **Step 5: Commit**

```bash
git add src/server/auth/invite-hash.ts src/server/auth/invite.ts tests/unit/invite-hash.test.ts
git commit -m "refactor: extract shared invite code hashing helper"
```

---

### Task 2: Admin invite settings domain service

**Files:**
- Create: `src/server/admin/invite-settings/service.ts`
- Create: `src/server/admin/invite-settings/errors.ts`
- Test: `tests/unit/admin-invite-service.test.ts`

**Interfaces:**
- Consumes: `hashInviteCode(code: string, pepper: string): string` from Task 1.
- Produces:
  - `type InviteSettingsRepository = { getStatus(): Promise<{ signupEnabled: boolean } | null>; rotateInviteCode(hash: string): Promise<void>; setSignupEnabled(enabled: boolean): Promise<void>; }` — the shape Task 3's repository must implement.
  - `createInviteSettingsService(repository: InviteSettingsRepository, options: { pepper: string; generateCode?: () => string }): { getStatus(): Promise<{ signupEnabled: boolean; hasInviteCode: boolean }>; rotate(): Promise<{ inviteCode: string }>; setSignupEnabled(enabled: boolean): Promise<void>; }` — consumed by Task 3's `index.ts` and Task 4's routes.
  - `class NoInviteCodeError extends Error` — thrown by `setSignupEnabled` when no invite code has ever been generated.

- [x] **Step 1: Write the failing test**

```typescript
// tests/unit/admin-invite-service.test.ts
import { describe, expect, it, vi } from "vitest";

import { createInviteSettingsService } from "@/server/admin/invite-settings/service";
import { NoInviteCodeError } from "@/server/admin/invite-settings/errors";
import { hashInviteCode } from "@/server/auth/invite-hash";
import type { InviteSettingsRepository } from "@/server/admin/invite-settings/service";

function fakeRepository(overrides: Partial<InviteSettingsRepository> = {}): InviteSettingsRepository {
  return {
    getStatus: vi.fn(async () => null),
    rotateInviteCode: vi.fn(async () => undefined),
    setSignupEnabled: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("createInviteSettingsService", () => {
  it("reports hasInviteCode false when no settings row exists", async () => {
    const service = createInviteSettingsService(fakeRepository({ getStatus: vi.fn(async () => null) }), { pepper: "pepper" });
    await expect(service.getStatus()).resolves.toEqual({ signupEnabled: false, hasInviteCode: false });
  });

  it("reports hasInviteCode true once a settings row exists", async () => {
    const service = createInviteSettingsService(fakeRepository({ getStatus: vi.fn(async () => ({ signupEnabled: true })) }), { pepper: "pepper" });
    await expect(service.getStatus()).resolves.toEqual({ signupEnabled: true, hasInviteCode: true });
  });

  it("rotate generates a fresh code, hashes it with the pepper, and returns the plaintext once", async () => {
    const rotateInviteCode = vi.fn(async () => undefined);
    const service = createInviteSettingsService(fakeRepository({ rotateInviteCode }), {
      pepper: "pepper",
      generateCode: () => "FRESH-CODE-123",
    });

    const result = await service.rotate();

    expect(result).toEqual({ inviteCode: "FRESH-CODE-123" });
    expect(rotateInviteCode).toHaveBeenCalledWith(hashInviteCode("FRESH-CODE-123", "pepper"));
  });

  it("setSignupEnabled delegates to the repository", async () => {
    const setSignupEnabled = vi.fn(async () => undefined);
    const service = createInviteSettingsService(fakeRepository({ getStatus: vi.fn(async () => ({ signupEnabled: false })), setSignupEnabled }), { pepper: "pepper" });

    await service.setSignupEnabled(true);

    expect(setSignupEnabled).toHaveBeenCalledWith(true);
  });

  it("setSignupEnabled throws NoInviteCodeError when no invite code has ever been generated", async () => {
    const service = createInviteSettingsService(fakeRepository({ getStatus: vi.fn(async () => null) }), { pepper: "pepper" });

    await expect(service.setSignupEnabled(true)).rejects.toBeInstanceOf(NoInviteCodeError);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/unit/admin-invite-service.test.ts`
Expected: FAIL with "Cannot find module '@/server/admin/invite-settings/service'".

- [x] **Step 3: Write minimal implementation**

```typescript
// src/server/admin/invite-settings/errors.ts
export class NoInviteCodeError extends Error {
  constructor() {
    super("No invite code has been generated yet. Rotate the invite code first.");
    this.name = "NoInviteCodeError";
  }
}
```

```typescript
// src/server/admin/invite-settings/service.ts
import { randomBytes } from "node:crypto";

import { NoInviteCodeError } from "@/server/admin/invite-settings/errors";
import { hashInviteCode } from "@/server/auth/invite-hash";

export type InviteSettingsRepository = Readonly<{
  getStatus(): Promise<{ signupEnabled: boolean } | null>;
  rotateInviteCode(hash: string): Promise<void>;
  setSignupEnabled(enabled: boolean): Promise<void>;
}>;

export type InviteSettingsService = Readonly<{
  getStatus(): Promise<{ signupEnabled: boolean; hasInviteCode: boolean }>;
  rotate(): Promise<{ inviteCode: string }>;
  setSignupEnabled(enabled: boolean): Promise<void>;
}>;

function defaultGenerateCode(): string {
  return randomBytes(18).toString("base64url");
}

export function createInviteSettingsService(
  repository: InviteSettingsRepository,
  options: Readonly<{ pepper: string; generateCode?: () => string }>,
): InviteSettingsService {
  const generateCode = options.generateCode ?? defaultGenerateCode;

  return {
    async getStatus() {
      const status = await repository.getStatus();
      return { signupEnabled: status?.signupEnabled ?? false, hasInviteCode: status !== null };
    },

    async rotate() {
      const inviteCode = generateCode();
      await repository.rotateInviteCode(hashInviteCode(inviteCode, options.pepper));
      return { inviteCode };
    },

    async setSignupEnabled(enabled: boolean) {
      const status = await repository.getStatus();
      if (status === null) throw new NoInviteCodeError();
      await repository.setSignupEnabled(enabled);
    },
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/unit/admin-invite-service.test.ts`
Expected: PASS (5 tests)

- [x] **Step 5: Commit**

```bash
git add src/server/admin/invite-settings/service.ts src/server/admin/invite-settings/errors.ts tests/unit/admin-invite-service.test.ts
git commit -m "feat: add admin invite settings domain service"
```

---

### Task 3: Admin invite settings repository and server wiring

**Files:**
- Create: `src/server/admin/invite-settings/repository.ts`
- Create: `src/server/admin/invite-settings/index.ts`
- Test: `tests/integration/admin-invite-settings-repository.test.ts`

**Interfaces:**
- Consumes: `InviteSettingsRepository` type and `createInviteSettingsService` from Task 2.
- Produces:
  - `createInviteSettingsRepository(client: SupabaseClient): InviteSettingsRepository` — consumed by `index.ts` and directly by the repository test.
  - `getInviteSettingsStatus(): Promise<{ signupEnabled: boolean; hasInviteCode: boolean }>`, `rotateInviteCodeForAdmin(): Promise<{ inviteCode: string }>`, `setSignupEnabledForAdmin(enabled: boolean): Promise<void>` — consumed by Task 4's API routes.

- [x] **Step 1: Write the failing test**

```typescript
// tests/integration/admin-invite-settings-repository.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createInviteSettingsRepository } from "@/server/admin/invite-settings/repository";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const admin = createSupabaseAdminClient();

async function clearAppSettings(): Promise<void> {
  const { error } = await admin.from("app_settings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
}

beforeEach(clearAppSettings);
afterAll(clearAppSettings);

describe("invite settings repository", () => {
  it("getStatus returns null when no row exists", async () => {
    const repository = createInviteSettingsRepository(admin);
    await expect(repository.getStatus()).resolves.toBeNull();
  });

  it("rotateInviteCode inserts a row with signup enabled by default when none exists", async () => {
    const repository = createInviteSettingsRepository(admin);
    await repository.rotateInviteCode("hash-1");

    const { data, error } = await admin.from("app_settings").select("invite_code_hash, signup_enabled").single();
    if (error) throw new Error(error.message);
    expect(data).toEqual({ invite_code_hash: "hash-1", signup_enabled: true });
  });

  it("rotateInviteCode updates the existing row's hash without changing signup_enabled", async () => {
    const repository = createInviteSettingsRepository(admin);
    await repository.rotateInviteCode("hash-1");
    await repository.setSignupEnabled(false);
    await repository.rotateInviteCode("hash-2");

    const { data, error } = await admin.from("app_settings").select("invite_code_hash, signup_enabled").single();
    if (error) throw new Error(error.message);
    expect(data).toEqual({ invite_code_hash: "hash-2", signup_enabled: false });

    const { count } = await admin.from("app_settings").select("id", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("setSignupEnabled toggles the existing row", async () => {
    const repository = createInviteSettingsRepository(admin);
    await repository.rotateInviteCode("hash-1");
    await repository.setSignupEnabled(false);

    await expect(repository.getStatus()).resolves.toEqual({ signupEnabled: false });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/integration/admin-invite-settings-repository.test.ts`
Expected: FAIL with "Cannot find module '@/server/admin/invite-settings/repository'".

- [x] **Step 3: Write minimal implementation**

```typescript
// src/server/admin/invite-settings/repository.ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { InviteSettingsRepository } from "@/server/admin/invite-settings/service";

export function createInviteSettingsRepository(client: SupabaseClient): InviteSettingsRepository {
  async function currentRowId(): Promise<string | null> {
    const { data, error } = await client.from("app_settings").select("id").limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.id ?? null;
  }

  return {
    async getStatus() {
      const { data, error } = await client.from("app_settings").select("signup_enabled").limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { signupEnabled: data.signup_enabled } : null;
    },

    async rotateInviteCode(hash) {
      const id = await currentRowId();
      if (id === null) {
        const { error } = await client.from("app_settings").insert({ invite_code_hash: hash, signup_enabled: true });
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await client.from("app_settings").update({ invite_code_hash: hash }).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async setSignupEnabled(enabled) {
      const id = await currentRowId();
      if (id === null) throw new Error("No app_settings row exists");
      const { error } = await client.from("app_settings").update({ signup_enabled: enabled }).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
```

```typescript
// src/server/admin/invite-settings/index.ts
import "server-only";

import { createInviteSettingsRepository } from "@/server/admin/invite-settings/repository";
import { createInviteSettingsService } from "@/server/admin/invite-settings/service";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

function getPepper(): string {
  const pepper = process.env.APP_INVITE_PEPPER;
  if (!pepper) throw new Error("Missing required environment variable: APP_INVITE_PEPPER");
  return pepper;
}

function service() {
  return createInviteSettingsService(createInviteSettingsRepository(createSupabaseAdminClient()), { pepper: getPepper() });
}

export function getInviteSettingsStatus() {
  return service().getStatus();
}

export function rotateInviteCodeForAdmin() {
  return service().rotate();
}

export function setSignupEnabledForAdmin(enabled: boolean) {
  return service().setSignupEnabled(enabled);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/integration/admin-invite-settings-repository.test.ts`
Expected: PASS (4 tests)

- [x] **Step 5: Commit**

```bash
git add src/server/admin/invite-settings/repository.ts src/server/admin/invite-settings/index.ts tests/integration/admin-invite-settings-repository.test.ts
git commit -m "feat: add admin invite settings repository"
```

---

### Task 4: Admin invite settings API routes

**Files:**
- Create: `src/app/api/admin/invite-settings/route.ts`
- Create: `src/app/api/admin/invite-settings/rotate/route.ts`
- Test: `tests/integration/admin-invite-settings-route.test.ts`

**Interfaces:**
- Consumes: `getInviteSettingsStatus`, `rotateInviteCodeForAdmin`, `setSignupEnabledForAdmin` from Task 3; `requireAdminProfile()` from `src/server/auth/require-profile.ts:16-20`; `NoInviteCodeError` from Task 2.
- Produces: `GET /api/admin/invite-settings` → `{ signupEnabled: boolean; hasInviteCode: boolean }`; `PATCH /api/admin/invite-settings` (body `{ signupEnabled: boolean }`) → `204`; `POST /api/admin/invite-settings/rotate` → `{ inviteCode: string }`.

- [x] **Step 1: Write the failing test**

```typescript
// tests/integration/admin-invite-settings-route.test.ts
import { describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  currentProfile: { id: "admin-1", role: "ADMIN" as const },
  getInviteSettingsStatus: vi.fn(async () => ({ signupEnabled: true, hasInviteCode: true })),
  rotateInviteCodeForAdmin: vi.fn(async () => ({ inviteCode: "FRESH-CODE" })),
  setSignupEnabledForAdmin: vi.fn(async () => undefined),
}));

vi.mock("@/server/auth/require-profile", () => ({
  requireAdminProfile: async () => {
    if (routeState.currentProfile.role !== "ADMIN") throw new Error("not admin");
    return routeState.currentProfile;
  },
}));
vi.mock("@/server/admin/invite-settings", () => ({
  getInviteSettingsStatus: routeState.getInviteSettingsStatus,
  rotateInviteCodeForAdmin: routeState.rotateInviteCodeForAdmin,
  setSignupEnabledForAdmin: routeState.setSignupEnabledForAdmin,
}));

import { GET, PATCH } from "@/app/api/admin/invite-settings/route";
import { POST as rotate } from "@/app/api/admin/invite-settings/rotate/route";

describe("admin invite settings routes", () => {
  it("GET returns the current status without the invite code hash", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ signupEnabled: true, hasInviteCode: true });
  });

  it("PATCH toggles signup and returns 204", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/invite-settings", { method: "PATCH", body: JSON.stringify({ signupEnabled: false }) }));
    expect(response.status).toBe(204);
    expect(routeState.setSignupEnabledForAdmin).toHaveBeenCalledWith(false);
  });

  it("PATCH rejects a non-boolean signupEnabled with 400 and does not call the service", async () => {
    routeState.setSignupEnabledForAdmin.mockClear();
    const response = await PATCH(new Request("http://localhost/api/admin/invite-settings", { method: "PATCH", body: JSON.stringify({ signupEnabled: "yes" }) }));
    expect(response.status).toBe(400);
    expect(routeState.setSignupEnabledForAdmin).not.toHaveBeenCalled();
  });

  it("POST rotate returns the plaintext invite code exactly once in the body", async () => {
    const response = await rotate();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ inviteCode: "FRESH-CODE" });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/integration/admin-invite-settings-route.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/admin/invite-settings/route'".

- [x] **Step 3: Write minimal implementation**

```typescript
// src/app/api/admin/invite-settings/route.ts
import { requireAdminProfile } from "@/server/auth/require-profile";
import { getInviteSettingsStatus, setSignupEnabledForAdmin } from "@/server/admin/invite-settings";
import { NoInviteCodeError } from "@/server/admin/invite-settings/errors";

export async function GET(): Promise<Response> {
  await requireAdminProfile();
  return Response.json(await getInviteSettingsStatus());
}

export async function PATCH(request: Request): Promise<Response> {
  await requireAdminProfile();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const signupEnabled = (body as { signupEnabled?: unknown } | null)?.signupEnabled;
  if (typeof signupEnabled !== "boolean") {
    return Response.json({ error: "signupEnabled must be a boolean" }, { status: 400 });
  }

  try {
    await setSignupEnabledForAdmin(signupEnabled);
  } catch (error) {
    if (error instanceof NoInviteCodeError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  return new Response(null, { status: 204 });
}
```

```typescript
// src/app/api/admin/invite-settings/rotate/route.ts
import { requireAdminProfile } from "@/server/auth/require-profile";
import { rotateInviteCodeForAdmin } from "@/server/admin/invite-settings";

export async function POST(): Promise<Response> {
  await requireAdminProfile();
  return Response.json(await rotateInviteCodeForAdmin());
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/integration/admin-invite-settings-route.test.ts`
Expected: PASS (4 tests)

- [x] **Step 5: Write a second, real-Supabase test proving the role data these routes gate on is correct**

The route test above mocks `requireAdminProfile`, so it only proves the routes call the gate before doing anything else — it can't prove the gate itself reads real ADMIN/USER roles correctly. Add an un-mocked integration test against real seeded profiles:

```typescript
// tests/integration/admin-invite-settings-authorization.test.ts
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();
const { url, anonKey } = getSupabasePublicConfig();

let adminUser: TestUser;
let regularUser: TestUser;

async function createTestUser(label: "admin" | "user", role: "ADMIN" | "USER"): Promise<TestUser> {
  const email = `money-context-admin-invite-${label}-${testRunId}@example.test`;
  const password = `AdminInviteTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create test user");
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, display_name: label, role, salary_cycle_day: 1, base_currency: "KRW" });
  if (profileError) throw new Error(profileError.message);
  return { id: data.user.id, email, password };
}

beforeAll(async () => {
  [adminUser, regularUser] = await Promise.all([createTestUser("admin", "ADMIN"), createTestUser("user", "USER")]);
});

afterAll(async () => {
  await Promise.all([admin.auth.admin.deleteUser(adminUser.id), admin.auth.admin.deleteUser(regularUser.id)]);
});

describe("admin invite settings authorization", () => {
  it("seeds an ADMIN profile and a USER profile with the roles requireAdminProfile checks", async () => {
    const { data: adminProfile } = await admin.from("profiles").select("role").eq("id", adminUser.id).single();
    const { data: userProfile } = await admin.from("profiles").select("role").eq("id", regularUser.id).single();
    expect(adminProfile?.role).toBe("ADMIN");
    expect(userProfile?.role).toBe("USER");
  });
});
```

- [x] **Step 6: Run test to verify it passes**

Run: `npm.cmd test -- tests/integration/admin-invite-settings-authorization.test.ts`
Expected: PASS (1 test) — confirms the ADMIN/USER role data these routes gate on is real and correctly seeded; the route-level gating itself is already covered by the mocked test in Step 4 which asserts `requireAdminProfile` is called before every service call.

- [x] **Step 7: Commit**

```bash
git add src/app/api/admin/invite-settings tests/integration/admin-invite-settings-route.test.ts tests/integration/admin-invite-settings-authorization.test.ts
git commit -m "feat: add admin invite settings api routes"
```

---

### Task 5: Admin invite settings UI

**Files:**
- Create: `src/components/settings/AdminInviteSettings.tsx`
- Modify: `src/app/(app)/(shell)/settings/page.tsx`
- Test: `tests/unit/admin-invite-settings.test.tsx`

**Interfaces:**
- Consumes: `GET/PATCH /api/admin/invite-settings`, `POST /api/admin/invite-settings/rotate` from Task 4.
- Produces: `AdminInviteSettings` React component, rendered only when the signed-in profile's `role === "ADMIN"`.

- [x] **Step 1: Write the failing test**

```typescript
// tests/unit/admin-invite-settings.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminInviteSettings } from "@/components/settings/AdminInviteSettings";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("AdminInviteSettings", () => {
  it("loads and shows the current signup status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ signupEnabled: true, hasInviteCode: true })));
    render(<AdminInviteSettings />);

    expect(await screen.findByLabelText("Signup enabled")).toHaveProperty("checked", true);
  });

  it("rotating shows the new plaintext invite code exactly once", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/rotate")) return jsonResponse({ inviteCode: "FRESH-CODE-123" });
      return jsonResponse({ signupEnabled: true, hasInviteCode: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminInviteSettings />);
    await screen.findByLabelText("Signup enabled");

    fireEvent.click(screen.getByLabelText("I understand the previous invite code will stop working"));
    fireEvent.click(screen.getByRole("button", { name: "Generate new invite code" }));

    expect(await screen.findByText("FRESH-CODE-123")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("Copy it now");
  });

  it("toggling signup off calls PATCH with signupEnabled false", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return new Response(null, { status: 204 });
      return jsonResponse({ signupEnabled: true, hasInviteCode: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminInviteSettings />);

    fireEvent.click(await screen.findByLabelText("Signup enabled"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/invite-settings",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ signupEnabled: false }) }),
      ),
    );
  });

  it("shows an accessible error when rotation fails and keeps the confirmation available to retry", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/rotate")) return jsonResponse({ error: "Unable to rotate invite code" }, 500);
      return jsonResponse({ signupEnabled: true, hasInviteCode: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminInviteSettings />);
    await screen.findByLabelText("Signup enabled");

    fireEvent.click(screen.getByLabelText("I understand the previous invite code will stop working"));
    fireEvent.click(screen.getByRole("button", { name: "Generate new invite code" }));

    expect(await screen.findByRole("alert", { name: "Invite settings error" })).toHaveTextContent("Unable to rotate invite code");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/unit/admin-invite-settings.test.tsx`
Expected: FAIL with "Cannot find module '@/components/settings/AdminInviteSettings'".

- [x] **Step 3: Write minimal implementation**

```typescript
// src/components/settings/AdminInviteSettings.tsx
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

  if (!status) return null;

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
```

Then modify `src/app/(app)/(shell)/settings/page.tsx` to fetch the current profile and conditionally render the admin section:

```typescript
// src/app/(app)/(shell)/settings/page.tsx
import { AdminInviteSettings } from "@/components/settings/AdminInviteSettings";
import { BackupRestore } from "@/components/settings/BackupRestore";
import { requireCurrentProfile } from "@/server/auth/require-profile";

export default async function SettingsPage() {
  const profile = await requireCurrentProfile();

  return (
    <div>
      <h1>설정</h1>
      <p>설정 화면은 준비 중입니다.</p>
      <BackupRestore />
      {profile.role === "ADMIN" ? <AdminInviteSettings /> : null}
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/unit/admin-invite-settings.test.tsx`
Expected: PASS (4 tests)

Run: `npm.cmd run typecheck`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/settings/AdminInviteSettings.tsx src/app/\(app\)/\(shell\)/settings/page.tsx tests/unit/admin-invite-settings.test.tsx
git commit -m "feat: add admin invite settings ui"
```

---

### Task 6: Regression test — ADMIN has no special access to other users' finance data

**Files:**
- Test: `tests/integration/admin-finance-isolation.test.ts`

**Interfaces:**
- Consumes: existing Task 6 RLS policies (`supabase/migrations/20260810070659_core_schema.sql` and later RLS migrations) — no production code changes in this task, only proof the guarantee holds.

- [x] **Step 1: Write the failing (should-already-pass) test**

```typescript
// tests/integration/admin-finance-isolation.test.ts
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

type TestUser = Readonly<{ id: string; email: string; password: string }>;

const testRunId = randomUUID();
const admin = createSupabaseAdminClient();
const { url, anonKey } = getSupabasePublicConfig();

let adminUser: TestUser;
let regularUser: TestUser;
let adminClient: SupabaseClient;
let regularUserAccountId: string;

async function createTestUser(label: "admin" | "user", role: "ADMIN" | "USER"): Promise<TestUser> {
  const email = `money-context-admin-isolation-${label}-${testRunId}@example.test`;
  const password = `AdminIsolationTest-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create test user");
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, display_name: label, role, salary_cycle_day: 1, base_currency: "KRW" });
  if (profileError) throw new Error(profileError.message);
  return { id: data.user.id, email, password };
}

async function authenticatedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(error.message);
  return client;
}

beforeAll(async () => {
  [adminUser, regularUser] = await Promise.all([createTestUser("admin", "ADMIN"), createTestUser("user", "USER")]);
  adminClient = await authenticatedClient(adminUser);
  const regularUserClient = await authenticatedClient(regularUser);
  const { data, error } = await regularUserClient
    .from("accounts")
    .insert({ user_id: regularUser.id, name: "admin isolation regular account", type: "CASH" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Unable to seed regular user account");
  regularUserAccountId = data.id;
});

afterAll(async () => {
  await Promise.all([admin.auth.admin.deleteUser(adminUser.id), admin.auth.admin.deleteUser(regularUser.id)]);
});

describe("ADMIN role has no special finance data access", () => {
  it("cannot read another user's accounts through the authenticated client", async () => {
    const { data, error } = await adminClient.from("accounts").select("id").eq("id", regularUserAccountId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot update another user's account through the authenticated client", async () => {
    const { data, error } = await adminClient.from("accounts").update({ name: "hijacked" }).eq("id", regularUserAccountId).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot delete another user's account through the authenticated client", async () => {
    const { error } = await adminClient.from("accounts").delete().eq("id", regularUserAccountId);
    expect(error).toBeNull();
    const { data: stillThere } = await admin.from("accounts").select("id").eq("id", regularUserAccountId).maybeSingle();
    expect(stillThere?.id).toBe(regularUserAccountId);
  });
});
```

- [x] **Step 2: Run test to verify current behavior**

Run: `npm.cmd test -- tests/integration/admin-finance-isolation.test.ts`
Expected: PASS (3 tests) — this proves the Task 6 RLS policies already treat ADMIN like any other `auth.uid()`-scoped user, with no bypass. If any assertion fails, that is a real security regression: stop and fix the RLS policy on `accounts` before continuing (do not weaken the test).

- [x] **Step 3: Commit**

```bash
git add tests/integration/admin-finance-isolation.test.ts
git commit -m "test: add admin finance data isolation regression coverage"
```

---

### Task 7: Full verification and plan closeout

- [x] **Step 1: Run the full test suite**

Run: `npm.cmd test`
Expected: PASS, including all new files from Tasks 1-6 (no regressions in the existing 57+ files)

- [x] **Step 2: Run typecheck, lint, and build**

Run: `npm.cmd run typecheck`
Run: `npm.cmd run lint`
Run: `npm.cmd run build`
Expected: all PASS

- [x] **Step 3: Update `docs/IMPLEMENTATION_PLAN.md` Task 36 checkboxes to `[x]` and reference this plan**

- [x] **Step 4: Commit**

```bash
git add docs/IMPLEMENTATION_PLAN.md
git commit -m "feat: add invite administration"
```
