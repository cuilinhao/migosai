import { api } from '@/lib/server/errors';
import { createImageGeneration } from '@/lib/server/image-generations';

export const POST = api(async request => createImageGeneration(request));
