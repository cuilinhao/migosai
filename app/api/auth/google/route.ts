import { getEnv } from '@/lib/server/env';
import { startGoogle } from '@/lib/server/auth';
import { api } from '@/lib/server/errors';
export const GET=api(async(request)=>startGoogle(request,await getEnv()));
