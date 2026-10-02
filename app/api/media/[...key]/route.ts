import { getEnv,media,database } from '@/lib/server/env';
import { currentUser } from '@/lib/server/auth';
import { verifyMediaSignature,mediaResponse } from '@/lib/server/media';
import { api,ApiError } from '@/lib/server/errors';
export const dynamic='force-dynamic';
export const GET=api(async(request,context)=>{const env=await getEnv();const {key:parts}=await context.params;const key=parts.join('/');if(!/^users\/[\w-]+\/(uploads\/[\w-]+|results\/[\w-]+\/\d+)$/.test(key))throw new ApiError(404,'Media not found.');let allowed=key.includes('/uploads/')&&await verifyMediaSignature(env,key,new URL(request.url));if(!allowed){const user=await currentUser(request,env);allowed=!!user&&key.startsWith(`users/${user.id}/`);}if(!allowed)throw new ApiError(404,'Media not found.');const bucket=media(env);const range=request.headers.get('range');const object=await bucket.get(key,range?{range:request.headers}:undefined);if(!object)throw new ApiError(404,'Media not found.');return mediaResponse(object,!!range);});
