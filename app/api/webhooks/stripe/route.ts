import { getEnv } from '@/lib/server/env';
import { readLimited } from '@/lib/server/security';
import { verifyStripeWebhook } from '@/lib/server/stripe';
import { applyStripeEvent } from '@/lib/server/stripe-payments';
import { api } from '@/lib/server/errors';

export const POST = api(async request => {
  const env = await getEnv();
  const raw = await readLimited(request, 256 * 1024);
  const event = await verifyStripeWebhook(raw, request.headers.get('stripe-signature'), env);
  await applyStripeEvent(env, event);
  return Response.json({ received: true });
});
