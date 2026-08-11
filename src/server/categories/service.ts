import "server-only";
export type CategoryKind = "INCOME" | "EXPENSE" | "BOTH";
export type Category = Readonly<{ id: string; userId: string; name: string; kind: CategoryKind; isActive: boolean }>;
export type Tag = Readonly<{ id: string; userId: string; name: string; isActive: boolean }>;
export interface CategoryTagRepository { createCategory(userId: string, input: Omit<Category, "id" | "userId" | "isActive">): Promise<Category>; createTag(userId: string, input: Omit<Tag, "id" | "userId" | "isActive">): Promise<Tag>; deactivateCategory(userId: string, id: string): Promise<boolean>; deactivateTag(userId: string, id: string): Promise<boolean>; assignTag(userId: string, transactionId: string, tagId: string): Promise<boolean>; listCategories(userId: string, activeOnly: boolean): Promise<Category[]>; listTags(userId: string, activeOnly: boolean): Promise<Tag[]>; }
const name = (value: string) => { const result = value.trim(); if (!result) throw new Error("name is required"); return result; };
export function createCategoryTagService(repository: CategoryTagRepository) { return {
  createCategory: (userId: string, input: { name: string; kind: CategoryKind }) => repository.createCategory(userId, { name: name(input.name), kind: input.kind }),
  createTag: (userId: string, input: { name: string }) => repository.createTag(userId, { name: name(input.name) }),
  deactivateCategory: async (userId: string, id: string) => { if (!await repository.deactivateCategory(userId, id)) throw new Error("category not found"); },
  deactivateTag: async (userId: string, id: string) => { if (!await repository.deactivateTag(userId, id)) throw new Error("tag not found"); },
  assignTag: async (userId: string, transactionId: string, tagId: string) => { if (!await repository.assignTag(userId, transactionId, tagId)) throw new Error("transaction and tag must be owned by the current user"); },
  listCategories: (userId: string, activeOnly = true) => repository.listCategories(userId, activeOnly),
  listTags: (userId: string, activeOnly = true) => repository.listTags(userId, activeOnly),
}; }
