import { api } from '@/lib/server/errors';
import { createFlyingCarGeneration } from '@/lib/server/flyingcar';

export const POST = api(async request => createFlyingCarGeneration(request));
