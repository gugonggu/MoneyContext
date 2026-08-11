import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createRecurringRepository } from "@/server/recurring/repository";

describe("recurring repository generation", () => {
  it("maps generated occurrences returned by the current-user RPC", async () => {
    const calls: Array<Readonly<{ name: string; parameters: Record<string, unknown> }>> = [];
    const supabase = {
      rpc: async (name: string, parameters: Record<string, unknown>) => {
        calls.push({ name, parameters });
        return {
          data: [
            {
              rule_id: "rule-1",
              occurrence_date: "2026-08-15",
              transaction_status: "CONFIRMED",
            },
          ],
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    const generated = await createRecurringRepository(supabase).generateDue("user-a", "2026-08-15");

    expect(generated).toEqual([
      { ruleId: "rule-1", occurrenceDate: "2026-08-15", status: "CONFIRMED" },
    ]);
    expect(calls).toEqual([
      {
        name: "generate_due_recurring_transactions",
        parameters: { input_today: "2026-08-15" },
      },
    ]);
  });
});
