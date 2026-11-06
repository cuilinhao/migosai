import { createTrendVideoGeneration } from '@/lib/server/trend-video';
import { api } from '@/lib/server/errors';

export const POST = api(async request => createTrendVideoGeneration(request));
