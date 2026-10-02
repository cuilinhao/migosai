import { getEnv,database } from '@/lib/server/env';
import { requireUser } from '@/lib/server/auth';
import { api } from '@/lib/server/errors';
export const dynamic='force-dynamic';
export const GET=api(async(request)=>{const env=await getEnv(),user=await requireUser(request,env),db=database(env);const rows=await db.prepare('SELECT id,pack_id AS packId,amount AS amountCents,currency,credits,status,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all<Record<string,unknown>>();return Response.json({orders:rows.results.map(({created_at,...r})=>({...r,createdAt:new Date(Number(created_at)*1000).toISOString()}))},{headers:{'Cache-Control':'no-store'}});});
