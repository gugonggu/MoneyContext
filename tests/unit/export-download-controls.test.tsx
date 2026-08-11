import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownExport } from "@/components/export/MarkdownExport";

afterEach(cleanup);

function renderExport() {
  render(<MarkdownExport initialMarkdown="# 초기 내보내기" onGenerate={vi.fn(async () => "# 갱신된 내보내기")} />);
}

describe("export download controls", () => {
  it("provides accessible JSON and CSV downloads for the selected custom period", () => {
    renderExport();

    fireEvent.click(screen.getByRole("radio", { name: "직접 범위" }));
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-08-11" } });

    expect(screen.getByRole("link", { name: "JSON 다운로드" }).getAttribute("href")).toBe(
      "/api/export/json?kind=CUSTOM&startDate=2026-08-01&endDate=2026-08-11",
    );
    expect(screen.getByRole("link", { name: "CSV 다운로드" }).getAttribute("href")).toBe(
      "/api/export/csv?kind=CUSTOM&startDate=2026-08-01&endDate=2026-08-11",
    );
  });

  it("retains the selected recent period in both download links", () => {
    renderExport();

    fireEvent.change(screen.getByLabelText("최근 기간"), { target: { value: "6" } });

    expect(screen.getByRole("link", { name: "JSON 다운로드" }).getAttribute("href")).toBe(
      "/api/export/json?kind=RECENT&months=6",
    );
    expect(screen.getByRole("link", { name: "CSV 다운로드" }).getAttribute("href")).toBe(
      "/api/export/csv?kind=RECENT&months=6",
    );
  });
});
