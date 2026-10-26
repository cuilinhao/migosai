import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../components/auth-provider';
import { PricingCards } from '../components/pricing-cards';
import { LocaleProvider } from '../components/i18n/locale-provider';
import { getMessages } from '../lib/i18n';

const navigation = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(navigation.search) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': 'en', 'x-migos-pathname': '/hotel-lobby-ai-video-generator' }) }));
afterEach(() => vi.restoreAllMocks());

function render(time: string, purchase: 'packs' | 'subscription' = 'packs') {
  return renderToStaticMarkup(<AuthProvider><PricingCards initialPurchaseType={purchase} offerTime={Date.parse(time)}/></AuthProvider>);
}

describe('Black Friday pricing handoff', () => {
  it('keeps cash prices while showing the exact total and bonus during the campaign', () => {
    const html = render('2026-11-27T12:00:00Z');
    for (const credits of ['360', '1,140', '1,920', '3,960']) expect(html).toContain(`${credits} credits`);
    for (const amount of ['$9.90', '$29.90', '$49.90', '$99.90']) expect(html).toContain(amount);
    expect(html).toContain('300 + 60 bonus credits');
    expect(html).not.toContain('20% OFF');
  });

  it.each(['2026-11-19T23:59:59Z', '2026-12-02T00:00:00Z'])('shows regular pack credits outside the offer at %s', time => {
    const html = render(time);
    expect(html).toContain('300 credits');
    expect(html).toContain('950 credits');
    expect(html).not.toContain('300 + 60 bonus credits');
  });

  it('does not change subscription allowances during the campaign', () => {
    const html = render('2026-11-27T12:00:00Z', 'subscription');
    expect(html).toContain('550 credits per month');
    expect(html).not.toContain('660 credits per month');
  });

  it('quotes the current offer in the embedded Hotel Lobby purchase entry too', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-27T12:00:00Z'));
    const { HotelLobbyLanding } = await import('../components/sections/hotel-lobby-landing');
    function findPricing(node: ReactNode): ReactNode {
      if (Array.isArray(node)) return node.map(findPricing).find(Boolean);
      if (!isValidElement<{ children?: ReactNode }>(node)) return null;
      return node.type === PricingCards ? node : findPricing(node.props.children);
    }
    const pricing = findPricing(await HotelLobbyLanding());
    expect(pricing).not.toBeNull();
    expect(renderToStaticMarkup(<AuthProvider>{pricing}</AuthProvider>)).toContain('300 + 60 bonus credits');
  });

  it('selects packs for both Black Friday links and the normal pricing entry', async () => {
    const { PricingEntry } = await import('../components/black-friday/pricing-entry');
    navigation.search = 'promo=blackfriday';
    const campaign = renderToStaticMarkup(<AuthProvider><PricingEntry offerTime={Date.parse('2026-11-27T12:00:00Z')}/></AuthProvider>);
    expect(campaign).toContain('300 + 60 bonus credits');
    navigation.search = '';
    const regular = renderToStaticMarkup(<AuthProvider><PricingEntry offerTime={Date.parse('2026-11-27T12:00:00Z')}/></AuthProvider>);
    expect(regular).toContain('300 + 60 bonus credits');
    expect(regular).not.toContain('550 credits per month');
  });

  it.each(['subscription=updated', 'promo=blackfriday&subscription=updated'])('returns to subscription pricing after a confirmed plan change: %s', async search => {
    const { PricingEntry } = await import('../components/black-friday/pricing-entry');
    navigation.search = search;
    const html = renderToStaticMarkup(<AuthProvider><PricingEntry offerTime={Date.parse('2026-11-27T12:00:00Z')}/></AuthProvider>);
    expect(html).toContain('550 credits per month');
    expect(html).not.toContain('300 + 60 bonus credits');
    expect(html).toContain('Checking your subscription update…');
    expect(html).not.toContain('Subscription status updated');
  });

  it('does not select subscriptions for an unrelated or unconfirmed query', async () => {
    const { PricingEntry } = await import('../components/black-friday/pricing-entry');
    navigation.search = 'subscription=pending&checkout=completed&promo=blackfriday';
    const html = renderToStaticMarkup(<AuthProvider><PricingEntry offerTime={Date.parse('2026-11-27T12:00:00Z')}/></AuthProvider>);
    expect(html).toContain('300 + 60 bonus credits');
    expect(html).not.toContain('550 credits per month');
    expect(html).not.toContain('Checking your subscription update…');
  });

  it('localizes the campaign entry without adding internal acquisition UTM tags', async () => {
    const { CampaignBanner } = await import('../components/black-friday/campaign-banner');
    const html = renderToStaticMarkup(<LocaleProvider locale="zh-TW" messages={getMessages('zh-TW')}><CampaignBanner placement="home"/></LocaleProvider>);
    expect(html).toContain('href="/zh-TW/black-friday"');
    expect(html).not.toContain('utm_');
  });
});
