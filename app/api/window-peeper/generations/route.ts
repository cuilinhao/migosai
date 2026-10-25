import { api } from '@/lib/server/errors';
import { createWindowPeeperGeneration } from '@/lib/server/window-peeper';

export const POST = api(async request => createWindowPeeperGeneration(request));
