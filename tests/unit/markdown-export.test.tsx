import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownExport } from "@/components/export/MarkdownExport";

afterEach(cleanup);

function renderExport(action = vi.fn(async () => "# 갱신된 내보내기")) {
  render(<MarkdownExport initialMarkdown="# 초기 내보내기" onGenerate={action} />);
  return action;
}

describe("MarkdownExport", () => {
  it("defaults to the most recent one-month period", () => {
    renderExport();

    expect((screen.getByLabelText("최근 기간") as HTMLSelectElement).value).toBe("1");
    expect(screen.getByRole("radio", { name: "최근 기간" }).getAttribute("aria-checked")).toBe("true");
  });

  it("submits the selected preset and custom date range for a refreshed preview", async () => {
    const action = renderExport();

    fireEvent.change(screen.getByLabelText("분석 목적"), { target: { value: "BUDGET_REVIEW" } });
    fireEvent.click(screen.getByRole("radio", { name: "직접 범위" }));
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-08-11" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 갱신" }));

    await waitFor(() => expect(action).toHaveBeenCalledWith({
      preset: "BUDGET_REVIEW",
      period: { kind: "CUSTOM", startDate: "2026-08-01", endDate: "2026-08-11" },
    }));
    expect(await screen.findByText("# 갱신된 내보내기")).toBeTruthy();
  });

  it("rejects a custom range whose start date is after its end date without calling the server", async () => {
    const action = renderExport();

    fireEvent.click(screen.getByRole("radio", { name: "직접 범위" }));
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-08-11" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-08-01" } });
    fireEvent.click(screen.getByRole("button", { name: "미리보기 갱신" }));

    expect(action).not.toHaveBeenCalled();
    expect((await screen.findByRole("alert")).textContent).toContain("시작일은 종료일보다 늦을 수 없습니다");
  });

  it("changes the selected period and focus with Arrow, Home, and End keys", () => {
    renderExport();
    const recent = screen.getByRole("radio", { name: "최근 기간" });
    const month = screen.getByRole("radio", { name: "월 선택" });
    const custom = screen.getByRole("radio", { name: "직접 범위" });

    expect(recent.getAttribute("tabindex")).toBe("0");
    expect(month.getAttribute("tabindex")).toBe("-1");
    recent.focus();
    fireEvent.keyDown(recent, { key: "ArrowRight" });
    expect(month.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(month);
    fireEvent.keyDown(month, { key: "End" });
    expect(custom.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(custom);
    fireEvent.keyDown(custom, { key: "Home" });
    expect(recent.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(recent);
  });

  it("renders the supplied Markdown preview", () => {
    renderExport();

    expect(screen.getByLabelText("Markdown 미리보기").textContent).toContain("# 초기 내보내기");
  });

  it("copies the currently previewed Markdown and confirms the result", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderExport();

    fireEvent.click(screen.getByRole("button", { name: "Markdown 복사" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("# 초기 내보내기"));
    expect((await screen.findByRole("status")).textContent).toContain("복사되었습니다");
  });

  it("announces a server generation failure", async () => {
    renderExport(vi.fn(async () => { throw new Error("server failure"); }));

    fireEvent.click(screen.getByRole("button", { name: "미리보기 갱신" }));

    expect((await screen.findByRole("alert")).textContent).toContain("내보내기를 생성하지 못했습니다");
  });

  it("announces a clipboard failure", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => { throw new Error("clipboard failure"); }) },
    });
    renderExport();

    fireEvent.click(screen.getByRole("button", { name: "Markdown 복사" }));

    expect((await screen.findByRole("alert")).textContent).toContain("복사하지 못했습니다");
  });
});
