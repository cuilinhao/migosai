import { getEnv,appOrigin } from '@/lib/server/env';
import { logout } from '@/lib/server/auth';
import { sameOrigin } from '@/lib/server/security';
import { api } from '@/lib/server/errors';
export const POST=api(async(request)=>{const env=await getEnv();sameOrigin(request,appOrigin(env));return logout(request,env);});
