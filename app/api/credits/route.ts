import { getEnv,database } from '@/lib/server/env';
import { requireUser } from '@/lib/server/auth';
import { api } from '@/lib/server/errors';
export const dynamic='force-dynamic';
export const GET=api(async(request)=>{const env=await getEnv(),user=await requireUser(request,env),db=database(env);const rows=await db.prepare('SELECT id,amount,kind,reference_id AS referenceId,created_at FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all<Record<string,unknown>>();return Response.json({balance:user.credits,ledger:rows.results.map(({created_at,...r})=>({...r,createdAt:new Date(Number(created_at)*1000).toISOString()}))},{headers:{'Cache-Control':'no-store'}});});
