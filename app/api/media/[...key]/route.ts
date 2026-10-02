import { getEnv } from '@/lib/server/env';
import { serveUserMedia } from '@/lib/server/moderation-media';
import { api } from '@/lib/server/errors';
export const dynamic='force-dynamic';
export const GET=api(async(request,context)=>{const env=await getEnv();const {key:parts}=await context.params;return serveUserMedia(request,env,parts.join('/'));});
