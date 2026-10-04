import { registerEmail } from '@/lib/server/auth';
import { getEnv } from '@/lib/server/env';
import { api } from '@/lib/server/errors';
export const POST = api(async request => registerEmail(request, await getEnv()));
