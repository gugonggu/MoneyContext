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
    expect((screen.getByRole("button", { name: "계정 삭제" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("계정과 모든 금융 데이터가 영구적으로 삭제된다는 것을 이해했습니다"));

    expect((screen.getByRole("button", { name: "계정 삭제" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("deletes the account, signs out, and redirects on success", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DeleteAccount />);

    fireEvent.click(screen.getByLabelText("계정과 모든 금융 데이터가 영구적으로 삭제된다는 것을 이해했습니다"));
    fireEvent.click(screen.getByRole("button", { name: "계정 삭제" }));

    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/account/delete", { method: "POST" });
  });

  it("shows an accessible error and keeps confirmation when deletion fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "계정을 삭제할 수 없습니다" }), { status: 500 })));
    render(<DeleteAccount />);

    fireEvent.click(screen.getByLabelText("계정과 모든 금융 데이터가 영구적으로 삭제된다는 것을 이해했습니다"));
    fireEvent.click(screen.getByRole("button", { name: "계정 삭제" }));

    expect((await screen.findByRole("alert", { name: "계정 삭제 오류" })).textContent).toContain("계정을 삭제할 수 없습니다");
    expect(signOut).not.toHaveBeenCalled();
  });
});
