import "server-only";
import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createTransactionRepository } from "@/server/transactions/repository";
import { createTransactionService, type TransactionRecord, type TransactionSearchFilters } from "@/server/transactions/service";
export type { TransactionSearchFilters, TransactionSearchResult } from "@/server/transactions/service";
import { createSupabaseServerClient } from "@/server/supabase/server";
async function current() { const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]); return { userId: profile.id, service: createTransactionService(createTransactionRepository(supabase)) }; }
export async function listTransactionsForCurrentUser() { const { userId, service } = await current(); return service.list(userId); }
export async function createTransactionForCurrentUser(input: Omit<TransactionRecord, "id" | "userId" | "status">) { const { userId, service } = await current(); return service.create(userId, input); }
export async function updateTransactionForCurrentUser(id: string, input: Omit<TransactionRecord, "id" | "userId" | "status">) { const { userId, service } = await current(); return service.update(userId, id, input); }
export async function removeTransactionForCurrentUser(id: string) { const { userId, service } = await current(); return service.remove(userId, id); }
export async function confirmTransactionForCurrentUser(id: string) { const { userId, service } = await current(); return service.confirm(userId, id); }
export async function listRecentTransactionsForPatterns(limit?: number) { const { userId, service } = await current(); return service.listRecentForPatterns(userId, limit); }
export async function searchTransactionsForCurrentUser(filters: TransactionSearchFilters) { const { userId, service } = await current(); return service.search(userId, filters); }
export async function getTransactionForCurrentUser(id: string) { const { userId, service } = await current(); return service.get(userId, id); }
