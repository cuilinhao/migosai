import { getEnv,appOrigin } from '@/lib/server/env';
import { requireUser } from '@/lib/server/auth';
import { sameOrigin,jsonBody } from '@/lib/server/security';
import { createCheckout } from '@/lib/server/payments';
import { api } from '@/lib/server/errors';
export const POST=api(async(request)=>{const env=await getEnv();sameOrigin(request,appOrigin(env));const user=await requireUser(request,env);const body=await jsonBody(request);return Response.json(await createCheckout(env,user,body.packId,body.locale));});
