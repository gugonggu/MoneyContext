import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  currentProfile: { id: "user-a" },
  generateAnalysisJsonExport: vi.fn(async (userId: string) => ({ owner: userId })),
  generateTransactionCsvExport: vi.fn(async (userId: string) => `\uFEFFowner,amount\r\n${userId},1500\r\n`),
}));

vi.mock("@/server/auth/require-profile", () => ({
  requireCurrentProfile: async () => state.currentProfile,
}));

vi.mock("@/server/export", () => ({
  generateAnalysisJsonExport: state.generateAnalysisJsonExport,
  generateTransactionCsvExport: state.generateTransactionCsvExport,
}));

import { GET as getJsonExport } from "@/app/api/export/json/route";
import { GET as getCsvExport } from "@/app/api/export/csv/route";

describe("authenticated export download endpoints", () => {
  it("returns the analysis JSON as an attachment for the selected period", async () => {
    const response = await getJsonExport(new Request("https://money-context.test/api/export/json?kind=CUSTOM&startDate=2026-08-01&endDate=2026-08-31"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="money-context-analysis-2026-08-01_2026-08-31.json"');
    expect(await response.text()).toBe('{"owner":"user-a"}');
  });

  it("returns a BOM-prefixed transaction CSV attachment", async () => {
    const response = await getCsvExport(new Request("https://money-context.test/api/export/csv?kind=MONTH&month=2026-08"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="money-context-transactions-2026-08-01_2026-08-31.csv"');
    expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("rejects invalid period ranges before exporting data", async () => {
    state.generateAnalysisJsonExport.mockClear();

    const response = await getJsonExport(new Request("https://money-context.test/api/export/json?kind=CUSTOM&startDate=2026-08-31&endDate=2026-08-01"));

    expect(response.status).toBe(400);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.text()).toBe("Invalid export period");
    expect(state.generateAnalysisJsonExport).not.toHaveBeenCalled();
  });

  it("uses the authenticated profile instead of a user id supplied in the URL", async () => {
    state.currentProfile = { id: "user-a" };

    const response = await getJsonExport(new Request("https://money-context.test/api/export/json?kind=RECENT&months=1&userId=user-b"));

    expect(await response.text()).toBe('{"owner":"user-a"}');
  });
});
