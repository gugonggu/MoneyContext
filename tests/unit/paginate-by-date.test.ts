import { describe, expect, it } from "vitest";

import { paginateByDate } from "@/domain/transactions/paginate-by-date";

function row(transactionAt: string) {
  return { transactionAt };
}

describe("paginateByDate", () => {
  it("returns everything as-is when there is no overflow to inspect", () => {
    const rows = [row("2026-08-05T01:00:00Z"), row("2026-08-04T01:00:00Z")];
    const page = paginateByDate(rows, 20, false);

    expect(page).toEqual({ items: rows, consumedCount: 2, hasMore: false });
  });

  it("extends past targetSize to include the rest of the boundary day", () => {
    const rows = [
      row("2026-08-05T09:00:00Z"),
      row("2026-08-05T08:00:00Z"),
      row("2026-08-05T07:00:00Z"),
      row("2026-08-04T09:00:00Z"),
    ];

    const page = paginateByDate(rows, 2, false);

    expect(page.items).toHaveLength(3);
    expect(page.consumedCount).toBe(3);
    expect(page.hasMore).toBe(true);
  });

  it("does not extend when the boundary day ends exactly at targetSize", () => {
    const rows = [
      row("2026-08-05T09:00:00Z"),
      row("2026-08-05T08:00:00Z"),
      row("2026-08-04T09:00:00Z"),
      row("2026-08-03T09:00:00Z"),
    ];

    const page = paginateByDate(rows, 2, false);

    expect(page.items).toHaveLength(2);
    expect(page.consumedCount).toBe(2);
    expect(page.hasMore).toBe(true);
  });

  it("reports no more pages when the overflow batch's boundary day runs out of rows and the repository confirms it", () => {
    const rows = [row("2026-08-05T09:00:00Z"), row("2026-08-05T08:00:00Z"), row("2026-08-05T07:00:00Z")];

    const page = paginateByDate(rows, 2, false);

    expect(page.consumedCount).toBe(3);
    expect(page.hasMore).toBe(false);
  });

  it("still reports more pages when the boundary day's overflow was exhausted by the fetch cap, not by real data running out", () => {
    const rows = [row("2026-08-05T09:00:00Z"), row("2026-08-05T08:00:00Z"), row("2026-08-05T07:00:00Z")];

    const page = paginateByDate(rows, 2, true);

    expect(page.consumedCount).toBe(3);
    expect(page.hasMore).toBe(true);
  });
});
