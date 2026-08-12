import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminInviteSettings } from "@/components/settings/AdminInviteSettings";

afterEach(() => {
  cleanup();
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
    expect(screen.getByRole("status").textContent).toContain("Copy it now");
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

    expect((await screen.findByRole("alert", { name: "Invite settings error" })).textContent).toContain("Unable to rotate invite code");
  });
});
