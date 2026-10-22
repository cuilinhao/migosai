import { api } from '@/lib/server/errors';
import { getEnv } from '@/lib/server/env';
import { readAssetLibrary, updateAssetLibrary } from '@/lib/server/asset-library';

export const dynamic = 'force-dynamic';
export const GET = api(async request => readAssetLibrary(request, await getEnv()));
export const POST = api(async request => updateAssetLibrary(request, await getEnv()));
