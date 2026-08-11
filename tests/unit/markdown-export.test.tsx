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
});
