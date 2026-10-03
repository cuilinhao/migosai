import Stripe from 'stripe';
import type { Env } from './env';
import { ApiError } from './errors';

export function stripeMode(env: Env): 'test' | 'live' {
  if (env.STRIPE_MODE !== 'test' && env.STRIPE_MODE !== 'live') {
    throw new ApiError(503, 'Stripe payment environment is not configured.');
  }
  return env.STRIPE_MODE;
}

async function safeStripeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.origin !== 'https://api.stripe.com' || url.username || url.password) {
    throw new ApiError(502, 'Unexpected payment API address.');
  }
  const response = await fetch(url.href, { ...init, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => {});
    throw new ApiError(502, 'Payment API redirects are not allowed.');
  }
  return response;
}

export function stripeClient(env: Env): Stripe {
  const mode = stripeMode(env);
  if (!env.STRIPE_SECRET_KEY || !new RegExp(`^(sk|rk)_${mode}_[A-Za-z0-9]+$`).test(env.STRIPE_SECRET_KEY)) {
    throw new ApiError(503, 'Stripe credentials do not match the payment environment.');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-09-30.endive',
    httpClient: Stripe.createFetchHttpClient(safeStripeFetch),
    maxNetworkRetries: 0,
    timeout: 20_000,
    telemetry: false,
  });
}

export function stripeWebhookSecret(env: Env): string {
  if (!env.STRIPE_WEBHOOK_SECRET || !/^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET)) {
    throw new ApiError(503, 'Stripe webhook verification is not configured.');
  }
  return env.STRIPE_WEBHOOK_SECRET;
}

// Verify original bytes before parsing. The SDK checks age; also reject future
// timestamps so a clock error cannot create a long-lived replayable signature.
export async function verifyStripeWebhook(raw: string | Uint8Array, signature: string | null, env: Env): Promise<Stripe.Event> {
  const mode = stripeMode(env);
  const secret = stripeWebhookSecret(env);
  const timestamps = signature?.split(',').filter(part => part.startsWith('t=')) ?? [];
  const timestamp = timestamps.length === 1 && /^t=\d+$/.test(timestamps[0]) ? Number(timestamps[0].slice(2)) : NaN;
  if (!signature || signature.length > 4096 || !Number.isSafeInteger(timestamp) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
    throw new ApiError(401, 'Invalid payment webhook signature.');
  }
  let event: Stripe.Event;
  try {
    event = await Stripe.webhooks.constructEventAsync(raw, signature, secret,
      300, Stripe.createSubtleCryptoProvider());
  } catch { throw new ApiError(401, 'Invalid payment webhook signature.'); }
  if (!event || event.object !== 'event' || !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
    typeof event.type !== 'string' || !event.data?.object || event.livemode !== (mode === 'live') || event.account) {
    throw new ApiError(400, 'Payment webhook does not match this account or environment.');
  }
  return event;
}
