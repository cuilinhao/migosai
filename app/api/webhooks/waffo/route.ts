import { getEnv, database } from '@/lib/server/env';
import { readLimited } from '@/lib/server/security';
import { applyCheckout, recordReviewEvent } from '@/lib/server/payments';
import { verifyWaffoWebhook } from '@/lib/server/waffo';
import { api } from '@/lib/server/errors';

export const POST = api(async request => {
  const env = await getEnv();
  const raw = new TextDecoder().decode(await readLimited(request, 256 * 1024));
  const event = verifyWaffoWebhook(raw, request.headers.get('x-waffo-signature'), env);
  if (event.eventType === 'order.completed') {
    await applyCheckout(env, event);
  } else if (event.eventType === 'refund.succeeded' || event.eventType === 'refund.failed') {
    await recordReviewEvent(database(env), event);
  }
  return Response.json({ received: true });
});
