import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryTagRepository } from "@/server/categories/service";
export function createCategoryTagRepository(s: SupabaseClient): CategoryTagRepository { return {
  async createCategory(userId, x) { const { data, error } = await s.from("categories").insert({ user_id: userId, name: x.name, kind: x.kind }).select("id,user_id,name,kind,is_active").single(); if (error) throw new Error(error.message); return { id:data.id,userId:data.user_id,name:data.name,kind:data.kind,isActive:data.is_active }; },
  async createTag(userId, x) { const { data, error } = await s.from("tags").insert({ user_id:userId,name:x.name }).select("id,user_id,name,is_active").single(); if(error) throw new Error(error.message); return { id:data.id,userId:data.user_id,name:data.name,isActive:data.is_active }; },
  async deactivateCategory(userId,id) { const { data,error }=await s.from("categories").update({is_active:false}).eq("user_id",userId).eq("id",id).select("id").maybeSingle();if(error)throw new Error(error.message);return data!==null; },
  async deactivateTag(userId,id) { const { data,error }=await s.from("tags").update({is_active:false}).eq("user_id",userId).eq("id",id).select("id").maybeSingle();if(error)throw new Error(error.message);return data!==null; },
  async assignTag(userId,transactionId,tagId) { const { error }=await s.from("transaction_tags").insert({transaction_id:transactionId,tag_id:tagId}); if(error)return false; const {data}=await s.from("transactions").select("id").eq("user_id",userId).eq("id",transactionId).maybeSingle();return data!==null; },
  async listCategories(userId,activeOnly) { let q=s.from("categories").select("id,user_id,name,kind,is_active").eq("user_id",userId).order("sort_order").order("name"); if(activeOnly)q=q.eq("is_active",true); const {data,error}=await q; if(error)throw new Error(error.message); return data.map((row)=>({id:row.id,userId:row.user_id,name:row.name,kind:row.kind,isActive:row.is_active})); },
  async listTags(userId,activeOnly) { let q=s.from("tags").select("id,user_id,name,is_active").eq("user_id",userId).order("name"); if(activeOnly)q=q.eq("is_active",true); const {data,error}=await q; if(error)throw new Error(error.message); return data.map((row)=>({id:row.id,userId:row.user_id,name:row.name,isActive:row.is_active})); },
}; }
