import { getEnv } from '@/lib/server/env';
import { api } from '@/lib/server/errors';
import { saveReferenceUpload } from '@/lib/server/reference-uploads';

export const POST = api(async request => saveReferenceUpload(request, await getEnv()));
