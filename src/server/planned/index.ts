import "server-only";
import {requireCurrentProfile}from"@/server/auth/require-profile";import{createPlannedRepository}from"@/server/planned/repository";import{createPlannedTransactionService}from"@/server/planned/service";import{createSupabaseServerClient}from"@/server/supabase/server";
export async function confirmPlannedTransactionForCurrentUser(id:string){const[p,s]=await Promise.all([requireCurrentProfile(),createSupabaseServerClient()]);return createPlannedTransactionService(createPlannedRepository(s)).confirm(p.id,id);}
