import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut } }),
}));

import { DeleteAccount } from "@/components/settings/DeleteAccount";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  signOut.mockClear();
});

describe("DeleteAccount", () => {
  it("keeps the delete button disabled until the confirmation checkbox is checked", () => {
    render(<DeleteAccount />);
    expect((screen.getByRole("button", { name: "Delete account" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("I understand this will permanently delete my account and all my financial data"));

    expect((screen.getByRole("button", { name: "Delete account" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("deletes the account, signs out, and redirects on success", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DeleteAccount />);

    fireEvent.click(screen.getByLabelText("I understand this will permanently delete my account and all my financial data"));
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/account/delete", { method: "POST" });
  });

  it("shows an accessible error and keeps confirmation when deletion fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Unable to delete account" }), { status: 500 })));
    render(<DeleteAccount />);

    fireEvent.click(screen.getByLabelText("I understand this will permanently delete my account and all my financial data"));
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    expect((await screen.findByRole("alert", { name: "Delete account error" })).textContent).toContain("Unable to delete account");
    expect(signOut).not.toHaveBeenCalled();
  });
});
