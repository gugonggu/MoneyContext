import { describe, expect, it } from "vitest";

import {
  createPlannedTransactionService,
  type OwnedActiveAccount,
  type OwnedActiveCategory,
  type PlannedRepository,
  type PlannedTransactionInput,
  type PlannedTransactionRecord,
} from "@/server/planned/service";

const userId = "user-a";
const account: OwnedActiveAccount = { id: "account-a", userId, isActive: true };
const category: OwnedActiveCategory = { id: "category-a", userId, isActive: true };

const input: PlannedTransactionInput = {
  type: "EXPENSE",
  scheduledDate: "2026-09-01",
  amount: 200_000,
  currency: "KRW",
  accountId: account.id,
  categoryId: category.id,
  memo: "Planned rent",
};

function repository(options: {
  accounts?: ReadonlyArray<OwnedActiveAccount>;
  categories?: ReadonlyArray<OwnedActiveCategory>;
} = {}): PlannedRepository {
  const accounts = options.accounts ?? [account];
  const categories = options.categories ?? [category];
  const rows: PlannedTransactionRecord[] = [];
  let nextId = 1;

  return {
    findAccount: async (_userId, id) => accounts.find((item) => item.id === id) ?? null,
    findCategory: async (_userId, id) => categories.find((item) => item.id === id) ?? null,
    find: async (ownerId, id) => rows.find((row) => row.id === id && row.userId === ownerId) ?? null,
    create: async (ownerId, value) => {
      const row: PlannedTransactionRecord = { id: `planned-${nextId++}`, userId: ownerId, status: "PLANNED", ...value };
      rows.push(row);
      return row;
    },
    list: async (ownerId) => rows.filter((row) => row.userId === ownerId),
    update: async (ownerId, id, value) => {
      const existing = rows.find((row) => row.id === id && row.userId === ownerId);
      if (!existing) return null;
      const updated = { ...existing, ...value };
      rows.splice(rows.indexOf(existing), 1, updated);
      return updated;
    },
    remove: async (ownerId, id) => {
      const existing = rows.find((row) => row.id === id && row.userId === ownerId);
      if (!existing) return false;
      rows.splice(rows.indexOf(existing), 1);
      return true;
    },
    confirm: async (ownerId, id) => {
      const existing = rows.find((row) => row.id === id && row.userId === ownerId);
      if (!existing || existing.status !== "PLANNED") return null;
      existing.status = "CONFIRMED";
      existing.convertedTransactionId = "transaction-1";
      return existing;
    },
  };
}

describe("planned transaction service", () => {
  it("rejects a planned transaction that references an account outside the current user", async () => {
    const service = createPlannedTransactionService(repository());

    await expect(service.create(userId, { ...input, accountId: "other-user-account" })).rejects.toThrow("active account owned");
  });

  it("rejects an inactive category", async () => {
    const service = createPlannedTransactionService(repository({ categories: [{ ...category, isActive: false }] }));

    await expect(service.create(userId, input)).rejects.toThrow("active category owned");
  });

  it("creates a PLANNED transaction", async () => {
    const service = createPlannedTransactionService(repository());

    await expect(service.create(userId, input)).resolves.toMatchObject({ status: "PLANNED", amount: 200_000 });
  });

  it.each([
    ["a fractional amount", { amount: 200_000.5 }, "amount"],
    ["a foreign currency without an exchange rate", { currency: "USD" }, "exchangeRate"],
    ["a KRW baseAmount that does not match amount", { baseAmount: 1 }, "baseAmount must equal amount"],
    ["an invalid scheduled date", { scheduledDate: "2026-02-30" }, "date"],
  ])("rejects %s", async (_label, changes, message) => {
    const service = createPlannedTransactionService(repository());

    await expect(service.create(userId, { ...input, ...changes })).rejects.toThrow(message);
  });

  it("lists planned transactions scoped to the supplied user", async () => {
    const service = createPlannedTransactionService(repository());
    await service.create(userId, input);

    await expect(service.list(userId)).resolves.toHaveLength(1);
    await expect(service.list("other-user")).resolves.toEqual([]);
  });

  it("updates a PLANNED transaction", async () => {
    const service = createPlannedTransactionService(repository());
    const created = await service.create(userId, input);

    await expect(service.update(userId, created.id, { ...input, memo: "Updated memo" })).resolves.toMatchObject({ memo: "Updated memo" });
  });

  it("rejects updating a transaction outside the current user", async () => {
    const service = createPlannedTransactionService(repository());
    await service.create(userId, input);

    await expect(service.update("other-user", "planned-1", input)).rejects.toThrow("not found");
  });

  it("rejects updating a transaction that was already confirmed", async () => {
    const service = createPlannedTransactionService(repository());
    const created = await service.create(userId, input);
    await service.confirm(userId, created.id);

    await expect(service.update(userId, created.id, input)).rejects.toThrow("only a PLANNED transaction");
  });

  it("removes a PLANNED transaction", async () => {
    const service = createPlannedTransactionService(repository());
    const created = await service.create(userId, input);

    await service.remove(userId, created.id);
    await expect(service.list(userId)).resolves.toEqual([]);
  });

  it("rejects removing a transaction that was already confirmed", async () => {
    const service = createPlannedTransactionService(repository());
    const created = await service.create(userId, input);
    await service.confirm(userId, created.id);

    await expect(service.remove(userId, created.id)).rejects.toThrow("confirmed planned transaction cannot be deleted");
  });

  it("rejects a planned transaction that was already confirmed", async () => {
    const service = createPlannedTransactionService(repository());
    const created = await service.create(userId, input);
    await service.confirm(userId, created.id);

    await expect(service.confirm(userId, created.id)).rejects.toThrow("already confirmed");
  });

  it("rejects confirming a cancelled planned transaction", async () => {
    const cancelledRepository = repository();
    const service = createPlannedTransactionService(cancelledRepository);
    const created = await service.create(userId, input);
    await cancelledRepository.update(userId, created.id, { ...created, status: "CANCELLED" } as never);

    await expect(service.confirm(userId, created.id)).rejects.toThrow("cancelled planned transaction cannot be confirmed");
  });
});
