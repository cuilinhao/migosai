import { afterEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import type { User } from '../lib/contracts';
import { database, jobEnv } from './helpers';
import { createGuestWallet, restoreGuestWallet } from '../lib/server/guest-wallets';
import { createSession, currentUser } from '../lib/server/auth';
import { applyStripeEvent } from '../lib/server/stripe-payments';
import { POST as checkout } from '../app/api/checkout/route';
import { POST as generate } from '../app/api/images/route';
import { GET as orders } from '../app/api/orders/route';
import { GET as history } from '../app/api/generations/route';
import { GET as detail } from '../app/api/generations/[id]/route';

const routeEnv = vi.hoisted(() => ({ value: {} as ReturnType<typeof jobEnv> & Record<string, unknown> }));
vi.mock('../lib/server/env', async () => ({ ...await vi.importActual('../lib/server/env'), getEnv: async () => routeEnv.value }));
const origin = 'https://example.test';
const request = (path: string, cookie = '', body?: unknown, extra: Record<string, string> = {}) => new Request(origin + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { origin, cookie, 'content-type': 'application/json', ...extra },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const cookieFrom = (response: Response) => response.headers.get('set-cookie')!.split(';')[0];
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('guest purchase through recovery and generation', () => {
  it('uses a paid guest wallet immediately and keeps its orders, creations and balance through recovery without registration', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T00:00:00Z'));
    const { db, sqlite } = database();
    routeEnv.value = {
      ...jobEnv(db), KIE_API_KEY: 'test-key', KIE_MEDIA_HOSTS: 'tempfile.aiquickdraw.com',
      PAYMENT_PROVIDER: 'stripe', STRIPE_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_fixtureOnly123',
      STRIPE_WEBHOOK_SECRET: 'whsec_fixtureOnly123', STRIPE_PRICE_STARTER: 'price_guestflow123',
    };
    const env = routeEnv.value;
    const created = await createGuestWallet(request('/api/guest-wallet', '', {}), env);
    const guest = await created.json() as { user: User; recoveryCode: string; credits: number };
    const originalCookie = cookieFrom(created);
    expect(guest.credits).toBe(0);
    expect(guest.user.isGuest).toBe(true);
    const imageInput = { prompt: 'A friendly orange cat', images: [], aspect: 'auto', resolution: '1K', outputFormat: 'png' };
    const imageRequest = (cookie: string, idempotency = 'guest-image-once') => request('/api/images', cookie, imageInput, { 'Idempotency-Key': idempotency });
    expect((await generate(imageRequest(originalCookie), undefined)).status).toBe(402);

    let snapshot: Record<string, string> = {};
    let sent = new URLSearchParams();
    let paymentConfirmed = false;
    const price = { id: 'price_guestflow123', object: 'price', active: true, livemode: false, currency: 'usd', unit_amount: 990, type: 'one_time', recurring: null, product: 'prod_guestflow123' };
    const session = () => ({
      id: 'cs_test_guestflow123', object: 'checkout.session', livemode: false, mode: 'payment',
      status: paymentConfirmed ? 'complete' : 'open', payment_status: paymentConfirmed ? 'paid' : 'unpaid',
      client_reference_id: snapshot.orderId, metadata: snapshot, amount_total: 990, amount_subtotal: 990, currency: 'usd',
      payment_intent: 'pi_guestflow123', customer_details: { email: 'a@b.c' },
      url: 'https://checkout.stripe.com/c/pay/cs_test_guestflow123',
    });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin).toBe('https://api.stripe.com');
      if (url.pathname === '/v1/prices/price_guestflow123') return Response.json(price);
      if (url.pathname === '/v1/checkout/sessions' && init?.method === 'POST') {
        sent = new URLSearchParams(String(init.body));
        snapshot = Object.fromEntries([...sent].filter(([key]) => key.startsWith('metadata[')).map(([key, value]) => [key.slice(9, -1), value]));
        return Response.json(session());
      }
      if (url.pathname === '/v1/checkout/sessions/cs_test_guestflow123') return Response.json({
        ...session(),
        payment_intent: { id: 'pi_guestflow123', object: 'payment_intent', livemode: false, status: 'succeeded', amount: 990, amount_received: 990, currency: 'usd', metadata: snapshot },
        line_items: { object: 'list', has_more: false, data: [{ id: 'li_guestflow123', object: 'item', quantity: 1, amount_total: 990, amount_subtotal: 990, currency: 'usd', price }] },
      });
      throw new Error('Unexpected provider request');
    });
    const checkedOut = await checkout(request('/api/checkout', originalCookie, { packId: 'starter', expectedCredits: 300, expectedUserId: guest.user.id }), undefined);
    expect(checkedOut.status).toBe(200);
    const order = await checkedOut.json() as { orderId: string; buyerId: string };
    expect(order.buyerId).toBe(guest.user.id);
    expect(sent.has('customer_email')).toBe(false);
    expect(snapshot.userId).toBe(guest.user.id);
    expect(sqlite.prepare('SELECT count(*) AS n FROM password_credentials').get()).toEqual({ n: 0 });
    const event = () => ({ id: 'evt_guestflow123', object: 'event', livemode: false, type: 'checkout.session.completed', data: { object: session() } }) as unknown as Stripe.Event;
    await applyStripeEvent(env, event());
    expect((await currentUser(request('/api/me', originalCookie), env))?.credits).toBe(0);
    paymentConfirmed = true;
    await applyStripeEvent(env, event());
    expect((await currentUser(request('/api/me', originalCookie), env))?.credits).toBe(300);
    // Stripe's payer email matches the existing account, but cannot move the purchase to it.
    expect(sqlite.prepare("SELECT credits FROM users WHERE id='u'").get()).toEqual({ credits: 100 });

    const generated = await generate(imageRequest(originalCookie), undefined);
    expect(generated.status).toBe(202);
    const image = await generated.json() as { id: string };
    expect((await currentUser(request('/api/me', originalCookie), env))?.credits).toBe(295);
    expect(await (await orders(request('/api/orders', originalCookie), undefined)).json()).toMatchObject({ orders: [{ id: order.orderId, status: 'paid', credits: 300, amountCents: 990 }] });
    const otherCreated = await createGuestWallet(request('/api/guest-wallet', '', {}), env);
    const otherCookie = cookieFrom(otherCreated);
    expect(await (await orders(request('/api/orders', otherCookie), undefined)).json()).toEqual({ orders: [] });
    expect(await (await history(request('/api/generations', otherCookie), undefined)).json()).toEqual({ generations: [] });
    expect((await detail(request(`/api/generations/${image.id}`, otherCookie), { params: Promise.resolve({ id: image.id }) })).status).toBe(404);

    const restored = await restoreGuestWallet(request('/api/guest-wallet/restore', '', { recoveryCode: guest.recoveryCode }), env);
    expect(await restored.json()).toMatchObject({ user: { id: guest.user.id, isGuest: true }, credits: 295 });
    const restoredCookie = cookieFrom(restored);
    expect((await orders(request('/api/orders', originalCookie), undefined)).status).toBe(401);
    expect(await (await orders(request('/api/orders', restoredCookie), undefined)).json()).toMatchObject({ orders: [{ id: order.orderId, status: 'paid' }] });
    expect(await (await history(request('/api/generations', restoredCookie), undefined)).json()).toMatchObject({ generations: [{ id: image.id, kind: 'image', cost: 5 }] });
    expect(await (await generate(imageRequest(restoredCookie), undefined)).json()).toMatchObject({ id: image.id });
    expect((await generate(imageRequest(restoredCookie, 'guest-image-second'), undefined)).status).toBe(202);
    await applyStripeEvent(env, event());
    expect((await currentUser(request('/api/me', restoredCookie), env))?.credits).toBe(290);
    expect(sqlite.prepare("SELECT user_id,amount FROM credit_ledger WHERE kind='payment'").all()).toEqual([{ user_id: guest.user.id, amount: 300 }]);
    const normalCookie = (await createSession('u', env)).split(';')[0];
    expect(await (await orders(request('/api/orders', normalCookie + '; ' + restoredCookie), undefined)).json()).toEqual({ orders: [] });
    expect((await currentUser(request('/api/me', normalCookie + '; ' + restoredCookie), env))?.id).toBe('u');
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith('https://api.stripe.com/'))).toBe(true);
    sqlite.close();
  });
});
