import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createCalendarRepository } from "@/server/calendar/repository";
import { createCalendarService, type CalendarSourceData } from "@/server/calendar/service";

const EMPTY: CalendarSourceData = {
  transactions: [],
  planned: [],
  cards: [],
  recurringRules: [],
  confirmedRecurringDates: [],
};

describe("calendar service", () => {
  it("asks the repository for the whole 42-cell grid range, not just the month", async () => {
    const getSourceData = vi.fn().mockResolvedValue(EMPTY);

    await createCalendarService({ getSourceData }).getMonth("user-1", 2026, 8, "2026-08-12");

    expect(getSourceData).toHaveBeenCalledWith("user-1", {
      start: "2026-07-26",
      end: "2026-09-05",
    });
  });

  it("builds a 42-cell month from the repository data", async () => {
    const month = await createCalendarService({
      getSourceData: async () => ({
        ...EMPTY,
        transactions: [
          {
            id: "1",
            type: "EXPENSE",
            status: "CONFIRMED",
            transactionAt: "2026-08-05T03:00:00Z",
            baseAmount: 47_000,
            memo: "점심",
            categoryName: "식비",
            accountName: "국민 카드",
          },
        ],
      }),
    }).getMonth("user-1", 2026, 8, "2026-08-12");

    expect(month.cells).toHaveLength(42);
    expect(month.summary).toEqual({ income: 0, expense: 47_000, net: -47_000 });
    expect(month.cells.find((cell) => cell.date === "2026-08-05")?.transactions[0].memo).toBe("점심");
  });

  it("keeps planned transactions out of the summary while still marking them", async () => {
    const month = await createCalendarService({
      getSourceData: async () => ({
        ...EMPTY,
        planned: [
          {
            scheduledDate: "2026-08-20",
            type: "EXPENSE",
            amount: 30_000,
            baseAmount: 30_000,
            memo: "치과",
          },
        ],
      }),
    }).getMonth("user-1", 2026, 8, "2026-08-12");

    expect(month.summary.expense).toBe(0);
    expect(month.cells.find((cell) => cell.date === "2026-08-20")?.upcoming[0].label).toBe("치과");
  });

  it("marks the card payment day", async () => {
    const month = await createCalendarService({
      getSourceData: async () => ({
        ...EMPTY,
        cards: [{ accountId: "c1", accountName: "국민 카드", paymentDay: 25 }],
      }),
    }).getMonth("user-1", 2026, 8, "2026-08-12");

    expect(month.cells.find((cell) => cell.date === "2026-08-25")?.upcoming[0].kind).toBe("CARD_PAYMENT");
  });

  it("rejects a month outside 1..12", async () => {
    const service = createCalendarService({ getSourceData: async () => EMPTY });

    await expect(service.getMonth("user-1", 2026, 13, "2026-08-12")).rejects.toThrow();
    await expect(service.getMonth("user-1", 2026, 0, "2026-08-12")).rejects.toThrow();
  });
});

type QueryCall = Readonly<{ method: string; args: readonly unknown[] }>;

function calendarSupabase(responses: Record<string, readonly Record<string, unknown>[]>) {
  const queries: Array<{ table: string; calls: QueryCall[] }> = [];
  const supabase = {
    from(table: string) {
      const query = { table, calls: [] as QueryCall[] };
      queries.push(query);
      const builder = {
        select(...args: unknown[]) {
          query.calls.push({ method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          query.calls.push({ method: "eq", args });
          return builder;
        },
        in(...args: unknown[]) {
          query.calls.push({ method: "in", args });
          return builder;
        },
        gte(...args: unknown[]) {
          query.calls.push({ method: "gte", args });
          return builder;
        },
        lt(...args: unknown[]) {
          query.calls.push({ method: "lt", args });
          return builder;
        },
        lte(...args: unknown[]) {
          query.calls.push({ method: "lte", args });
          return builder;
        },
        order(...args: unknown[]) {
          query.calls.push({ method: "order", args });
          return builder;
        },
        then(resolve: (value: { data: readonly Record<string, unknown>[]; error: null }) => unknown) {
          return Promise.resolve({ data: responses[table] ?? [], error: null }).then(resolve);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  return { supabase, queries };
}

describe("calendar repository", () => {
  it("scopes all calendar sources to the user and queries the Seoul grid-day interval", async () => {
    const { supabase, queries } = calendarSupabase({});

    await createCalendarRepository(supabase).getSourceData("user-1", {
      start: "2026-07-26",
      end: "2026-09-05",
    });

    expect(queries.map((query) => query.table)).toEqual([
      "transactions",
      "planned_transactions",
      "credit_card_settings",
      "recurring_transactions",
    ]);
    for (const query of queries) {
      expect(query.calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
    }

    const transactions = queries[0].calls;
    expect(transactions).toContainEqual({ method: "eq", args: ["status", "CONFIRMED"] });
    expect(transactions).toContainEqual({ method: "in", args: ["type", ["INCOME", "EXPENSE"]] });
    expect(transactions).toContainEqual({
      method: "gte",
      args: ["transaction_at", "2026-07-25T15:00:00.000Z"],
    });
    expect(transactions).toContainEqual({
      method: "lt",
      args: ["transaction_at", "2026-09-05T15:00:00.000Z"],
    });
    expect(String(transactions.find((call) => call.method === "select")?.args[0])).toContain(
      "accounts!transactions_account_id_fkey(name)",
    );

    expect(queries[1].calls).toContainEqual({ method: "eq", args: ["status", "PLANNED"] });
    expect(queries[1].calls).toContainEqual({ method: "gte", args: ["scheduled_date", "2026-07-26"] });
    expect(queries[1].calls).toContainEqual({ method: "lte", args: ["scheduled_date", "2026-09-05"] });
    expect(String(queries[2].calls.find((call) => call.method === "select")?.args[0])).toContain(
      "accounts!credit_card_settings_account_id_fkey(name)",
    );
    expect(queries[3].calls).toContainEqual({ method: "eq", args: ["is_active", true] });
  });

  it("maps rows and uses confirmed recurring occurrence dates to suppress duplicate markers", async () => {
    const { supabase } = calendarSupabase({
      transactions: [
        {
          id: "tx-1",
          type: "EXPENSE",
          status: "CONFIRMED",
          transaction_at: "2026-08-04T15:00:00.000Z",
          base_amount: "47000",
          memo: "점심",
          recurring_rule_id: "rule-1",
          categories: [{ name: "식비" }],
          accounts: { name: "국민 카드" },
        },
      ],
      planned_transactions: [
        {
          scheduled_date: "2026-08-20",
          type: "EXPENSE",
          amount: "30000",
          base_amount: null,
          memo: "치과",
        },
      ],
      credit_card_settings: [
        { account_id: "card-1", payment_day: 25, accounts: [{ name: "국민 카드" }] },
      ],
      recurring_transactions: [
        {
          id: "rule-1",
          memo: "구독",
          type: "EXPENSE",
          amount: "9900",
          frequency: "MONTHLY",
          interval_count: 1,
          day_of_month: 5,
          next_run_date: "2026-08-05",
          end_date: null,
        },
      ],
    });

    await expect(
      createCalendarRepository(supabase).getSourceData("user-1", {
        start: "2026-07-26",
        end: "2026-09-05",
      }),
    ).resolves.toEqual({
      transactions: [
        {
          id: "tx-1",
          type: "EXPENSE",
          status: "CONFIRMED",
          transactionAt: "2026-08-04T15:00:00.000Z",
          baseAmount: 47_000,
          memo: "점심",
          categoryName: "식비",
          accountName: "국민 카드",
        },
      ],
      planned: [
        { scheduledDate: "2026-08-20", type: "EXPENSE", amount: 30_000, memo: "치과" },
      ],
      cards: [{ accountId: "card-1", accountName: "국민 카드", paymentDay: 25 }],
      recurringRules: [
        {
          id: "rule-1",
          memo: "구독",
          type: "EXPENSE",
          amount: 9_900,
          frequency: "MONTHLY",
          intervalCount: 1,
          dayOfMonth: 5,
          nextRunDate: "2026-08-05",
        },
      ],
      confirmedRecurringDates: [{ ruleId: "rule-1", date: "2026-08-05" }],
    });
  });
});
