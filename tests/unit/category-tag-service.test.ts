import { describe, expect, it } from "vitest";
import { createCategoryTagService, type CategoryTagRepository } from "@/server/categories/service";
const userId = "user-a";
const repository: CategoryTagRepository = {
  createCategory: async (_u, x) => ({ id: "c", userId, ...x, isActive: true }),
  createTag: async (_u, x) => ({ id: "t", userId, ...x, isActive: true }),
  deactivateCategory: async () => true,
  deactivateTag: async () => true,
  assignTag: async () => true,
  listCategories: async () => [{ id: "c1", userId, name: "식비", kind: "EXPENSE", isActive: true }],
  listTags: async () => [{ id: "t1", userId, name: "업무", isActive: true }],
};
describe("category and tag service", () => {
  it("rejects blank category names", () => expect(() => createCategoryTagService(repository).createCategory(userId, { name: " ", kind: "EXPENSE" })).toThrow("name is required"));
  it("normalizes tag names before persistence", async () => expect(createCategoryTagService(repository).createTag(userId, { name: "  식비  " })).resolves.toMatchObject({ name: "식비" }));
  it("lists categories through the repository", async () => expect(createCategoryTagService(repository).listCategories(userId)).resolves.toEqual([{ id: "c1", userId, name: "식비", kind: "EXPENSE", isActive: true }]));
  it("lists tags through the repository", async () => expect(createCategoryTagService(repository).listTags(userId)).resolves.toEqual([{ id: "t1", userId, name: "업무", isActive: true }]));
});
