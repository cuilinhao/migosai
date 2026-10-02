import { getEnv,appOrigin } from '@/lib/server/env';
import { requireUser } from '@/lib/server/auth';
import { sameOrigin,jsonBody } from '@/lib/server/security';
import { createCheckout } from '@/lib/server/payments';
import { api } from '@/lib/server/errors';
export const POST=api(async(request)=>{const env=await getEnv();sameOrigin(request,appOrigin(env));const user=await requireUser(request,env);return Response.json(await createCheckout(env,user,(await jsonBody(request)).packId));});
