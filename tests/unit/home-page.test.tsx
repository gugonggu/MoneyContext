import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as { id: string } | null, redirect: vi.fn() }));

vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("next/navigation", () => ({ redirect: state.redirect }));

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the marketing page with a working start link for a signed-out visitor", async () => {
    state.user = null;
    render(await HomePage());

    expect(screen.getByRole("heading", { level: 1, name: "Money Context" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "시작하기" }).getAttribute("href")).toBe("/invite");
    expect(state.redirect).not.toHaveBeenCalled();
  });

  it("redirects a signed-in visitor to /home instead of showing marketing copy", async () => {
    state.user = { id: "user-1" };
    await HomePage();

    expect(state.redirect).toHaveBeenCalledWith("/home");
  });
});
