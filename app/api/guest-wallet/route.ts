import { createGuestWallet } from '@/lib/server/guest-wallets';
import { getEnv } from '@/lib/server/env';
import { api } from '@/lib/server/errors';
export const POST = api(async request => createGuestWallet(request, await getEnv()));
