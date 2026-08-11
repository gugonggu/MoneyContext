import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/transactions" }));

import { AppShell } from "@/components/nav/AppShell";

afterEach(cleanup);

describe("AppShell", () => {
  it("renders both the desktop sidebar and the mobile bottom navigation", () => {
    render(<AppShell>내용</AppShell>);

    expect(screen.getByRole("navigation", { name: "주 메뉴" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "하단 메뉴" })).toBeTruthy();
  });

  it("marks the current route active in both navigations", () => {
    render(<AppShell>내용</AppShell>);

    expect(screen.getByRole("link", { name: "거래내역" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "내역" }).getAttribute("aria-current")).toBe("page");
    for (const link of screen.getAllByRole("link", { name: "홈" })) {
      expect(link.getAttribute("aria-current")).toBeNull();
    }
  });

  it("links the primary quick-entry action to the entry route", () => {
    render(<AppShell>내용</AppShell>);

    expect(screen.getByRole("link", { name: "입력" }).getAttribute("href")).toBe("/transactions/new");
  });

  it("provides a keyboard skip link to the main content", () => {
    render(<AppShell>내용</AppShell>);

    expect(screen.getByRole("link", { name: "메인 콘텐츠로 건너뛰기" }).getAttribute("href")).toBe("#main-content");
  });

  it("renders children inside the main content region", () => {
    render(<AppShell>고유한-내용-abc</AppShell>);

    expect(screen.getByRole("main").textContent).toContain("고유한-내용-abc");
  });
});
