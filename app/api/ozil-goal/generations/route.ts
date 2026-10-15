import { api } from '@/lib/server/errors';
import { createOzilGoalGeneration } from '@/lib/server/ozil-goal';

export const POST = api(async request => createOzilGoalGeneration(request));
