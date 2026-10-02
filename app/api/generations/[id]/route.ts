import { getEnv,database } from '@/lib/server/env';
import { requireUser } from '@/lib/server/auth';
import { api,ApiError } from '@/lib/server/errors';
import { generationResponse,advanceJob } from '@/lib/server/jobs';
import type { Job } from '@/lib/server/billing';
export const dynamic='force-dynamic';
export const GET=api(async(request,context)=>{const env=await getEnv(),user=await requireUser(request,env),{id}=await context.params;const db=database(env);let job=await db.prepare('SELECT * FROM generations WHERE id=? AND user_id=?').bind(id,user.id).first<Job>();if(!job)throw new ApiError(404,'Generation not found.');await advanceJob(env,id);job=await db.prepare('SELECT * FROM generations WHERE id=? AND user_id=?').bind(id,user.id).first<Job>();return Response.json(generationResponse(job!),{headers:{'Cache-Control':'no-store'}});});
