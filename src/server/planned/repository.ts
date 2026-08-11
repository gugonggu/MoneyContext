import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedRepository } from "@/server/planned/service";
export function createPlannedRepository(s:SupabaseClient):PlannedRepository{return{async find(userId,id){const{data,error}=await s.from("planned_transactions").select("id,user_id,status").eq("user_id",userId).eq("id",id).maybeSingle();if(error)throw new Error(error.message);return data?{id:data.id,userId:data.user_id,status:data.status}:null;},async confirm(_userId,id){const{data,error}=await s.rpc("confirm_planned_transaction",{input_planned_id:id});if(error)return null;return{id, userId:_userId,status:"CONFIRMED"};}};}
