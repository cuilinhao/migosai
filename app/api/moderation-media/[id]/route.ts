import { getEnv } from '@/lib/server/env';
import { api } from '@/lib/server/errors';
import { serveModerationMedia } from '@/lib/server/moderation-media';

export const dynamic = 'force-dynamic';
export const GET = api(async (request, context) => {
 const env = await getEnv();
 const { id } = await context.params;
 return serveModerationMedia(request, env, id);
});
