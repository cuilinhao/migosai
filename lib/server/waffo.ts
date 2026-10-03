import { WaffoPancake, verifyWebhook, type WebhookEvent, type WebhookEventData } from '@waffo/pancake-ts';
import type { Env } from './env';
import { ApiError } from './errors';

export type WaffoEvent = WebhookEvent<WebhookEventData>;

export function waffoMode(env: Env): 'test' | 'prod' {
  if (env.WAFFO_MODE !== 'test' && env.WAFFO_MODE !== 'prod') {
    throw new ApiError(503, 'Payment environment is not configured.');
  }
  return env.WAFFO_MODE;
}

export function waffoStoreId(env: Env): string {
  if (!env.WAFFO_STORE_ID || !/^STO_[A-Za-z0-9]{22}$/.test(env.WAFFO_STORE_ID)) {
    throw new ApiError(503, 'Payment store is not configured.');
  }
  return env.WAFFO_STORE_ID;
}

async function safeWaffoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.origin !== 'https://api.waffo.ai' || url.username || url.password) {
    throw new ApiError(502, 'Unexpected payment API address.');
  }
  const response = await fetch(url.href, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new ApiError(502, 'Payment API did not complete the request.');
  }
  return response;
}

export function waffoClient(env: Env): WaffoPancake {
  waffoMode(env);
  waffoStoreId(env);
  if (!env.WAFFO_MERCHANT_ID || !env.WAFFO_PRIVATE_KEY) {
    throw new ApiError(503, 'Payment credentials are not configured.');
  }
  try {
    return new WaffoPancake({
      merchantId: env.WAFFO_MERCHANT_ID,
      privateKey: env.WAFFO_PRIVATE_KEY,
      fetch: safeWaffoFetch,
    });
  } catch {
    throw new ApiError(503, 'Payment credentials are invalid.');
  }
}

export function verifyWaffoWebhook(raw: string, signature: string | null, env: Env): WaffoEvent {
  const mode = waffoMode(env);
  const storeId = waffoStoreId(env);
  let event: WaffoEvent;
  try {
    event = verifyWebhook<WebhookEventData>(raw, signature, { environment: mode });
  } catch {
    throw new ApiError(401, 'Invalid payment webhook signature.');
  }
  if (!event || event.mode !== mode || event.storeId !== storeId ||
    typeof event.id !== 'string' || typeof event.eventType !== 'string') {
    throw new ApiError(400, 'Payment webhook does not match this store.');
  }
  return event;
}
