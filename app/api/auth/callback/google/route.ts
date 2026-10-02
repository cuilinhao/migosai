import { getEnv } from '@/lib/server/env';
import { finishGoogle } from '@/lib/server/auth';
import { api } from '@/lib/server/errors';
export const GET=api(async(request)=>finishGoogle(request,await getEnv()));
