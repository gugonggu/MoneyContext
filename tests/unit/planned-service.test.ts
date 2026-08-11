import { describe, expect, it } from "vitest";
import { createPlannedTransactionService, type PlannedRepository } from "@/server/planned/service";
const repo: PlannedRepository = { find: async () => ({ id:"p",userId:"u",status:"CONFIRMED" }), confirm: async () => null };
describe("planned transaction service",()=>{it("rejects a planned transaction that was already confirmed",async()=>await expect(createPlannedTransactionService(repo).confirm("u","p")).rejects.toThrow("already confirmed"));});
