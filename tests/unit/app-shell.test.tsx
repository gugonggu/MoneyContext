import { cleanup, render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/transactions") }));

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

  it("exposes the calendar route in both navigations", () => {
    render(<AppShell>내용</AppShell>);

    const sidebar = screen.getByRole("navigation", { name: "주 메뉴" });
    const bottomNav = screen.getByRole("navigation", { name: "하단 메뉴" });

    expect(within(sidebar).getByRole("link", { name: "달력" }).getAttribute("href")).toBe("/calendar");
    expect(within(bottomNav).getByRole("link", { name: "달력" }).getAttribute("href")).toBe("/calendar");
  });

  it("shows the notification bell in the desktop top bar", () => {
    render(<AppShell>내용</AppShell>);

    expect(screen.getByRole("link", { name: "알림" }).getAttribute("href")).toBe("/notifications");
  });

  it("titles the top bar with the current route", () => {
    render(<AppShell>내용</AppShell>);

    expect(screen.getByRole("heading", { name: "거래내역" })).toBeTruthy();
  });

  it("titles the top bar with the quick-entry route, not its parent", () => {
    vi.mocked(usePathname).mockReturnValue("/transactions/new");
    try {
      render(<AppShell>내용</AppShell>);

      expect(screen.getByRole("heading", { name: "거래 입력" })).toBeTruthy();
    } finally {
      vi.mocked(usePathname).mockReturnValue("/transactions");
    }
  });
});
