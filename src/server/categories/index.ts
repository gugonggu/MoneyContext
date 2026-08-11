import "server-only";
import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createCategoryTagRepository } from "@/server/categories/repository";
import { createCategoryTagService, type CategoryKind } from "@/server/categories/service";
import { createSupabaseServerClient } from "@/server/supabase/server";
async function current(){const [p,s]=await Promise.all([requireCurrentProfile(),createSupabaseServerClient()]);return{userId:p.id,service:createCategoryTagService(createCategoryTagRepository(s))};}
export async function createCategoryForCurrentUser(name:string,kind:CategoryKind){const x=await current();return x.service.createCategory(x.userId,{name,kind});}
export async function createTagForCurrentUser(name:string){const x=await current();return x.service.createTag(x.userId,{name});}
export async function deactivateCategoryForCurrentUser(id:string){const x=await current();return x.service.deactivateCategory(x.userId,id);}
export async function deactivateTagForCurrentUser(id:string){const x=await current();return x.service.deactivateTag(x.userId,id);}
export async function assignTagForCurrentUser(transactionId:string,tagId:string){const x=await current();return x.service.assignTag(x.userId,transactionId,tagId);}
export async function listCategoriesForCurrentUser(activeOnly=true){const x=await current();return x.service.listCategories(x.userId,activeOnly);}
export async function listTagsForCurrentUser(activeOnly=true){const x=await current();return x.service.listTags(x.userId,activeOnly);}
