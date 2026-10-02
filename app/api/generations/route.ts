import { createGeneration } from '@/lib/server/generations';
import { api } from '@/lib/server/errors';
export const POST=api(async(request)=>createGeneration(request,'video'));

import { getEnv,database } from '@/lib/server/env';
import { requireUser } from '@/lib/server/auth';
import { generationResponse } from '@/lib/server/jobs';
import type { Job } from '@/lib/server/billing';
export const dynamic='force-dynamic';
export const GET=api(async(request)=>{const env=await getEnv(),user=await requireUser(request,env);const rows=await database(env).prepare('SELECT * FROM generations WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all<Job>();return Response.json({generations:rows.results.map(j=>({...generationResponse(j),kind:j.kind,cost:j.cost,createdAt:new Date(j.created_at*1000).toISOString()}))},{headers:{'Cache-Control':'no-store'}});});
