import "server-only";
import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createTransactionRepository } from "@/server/transactions/repository";
import { createTransactionService, type TransactionRecord } from "@/server/transactions/service";
import { createSupabaseServerClient } from "@/server/supabase/server";
async function current() { const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]); return { userId: profile.id, service: createTransactionService(createTransactionRepository(supabase)) }; }
export async function listTransactionsForCurrentUser() { const { userId, service } = await current(); return service.list(userId); }
export async function createTransactionForCurrentUser(input: Omit<TransactionRecord, "id" | "userId">) { const { userId, service } = await current(); return service.create(userId, input); }
export async function updateTransactionForCurrentUser(id: string, input: Omit<TransactionRecord, "id" | "userId">) { const { userId, service } = await current(); return service.update(userId, id, input); }
export async function removeTransactionForCurrentUser(id: string) { const { userId, service } = await current(); return service.remove(userId, id); }
