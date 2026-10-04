import { startOneTap, finishOneTap } from '@/lib/server/auth';
import { getEnv } from '@/lib/server/env';
import { api } from '@/lib/server/errors';
export const dynamic = 'force-dynamic';
export const GET = api(async request => startOneTap(request, await getEnv()));
export const POST = api(async request => finishOneTap(request, await getEnv()));
