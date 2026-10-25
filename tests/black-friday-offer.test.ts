import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { creditPacks } from '../content/pricing';
import { createCreditPackCampaignRegistry, getBlackFridayStatus, getCreditPackOffer, matchesCreditPackOfferMetadata } from '../content/black-friday-offer';

afterEach(() => vi.useRealTimers());
describe('Black Friday credit pack eligibility', () => {
  it.each([
    ['2026-11-19T23:59:59.999Z', 'upcoming', 0],
    ['2026-11-20T00:00:00.000Z', 'active', 60],
    ['2026-12-01T23:59:59.999Z', 'active', 60],
    ['2026-12-02T00:00:00.000Z', 'ended', 0],
    ['2027-11-27T00:00:00.000Z', 'ended', 0],
  ] as const)('quotes the correct offer at %s', (date, status, bonus) => {
    expect(getBlackFridayStatus(new Date(date))).toBe(status);
    expect(getCreditPackOffer(creditPacks[0], Date.parse(date))).toEqual({
      baseCredits: 300, bonusCredits: bonus, credits: 300 + bonus,
      campaignId: bonus ? 'black-friday-2026' : null,
    });
  });
  it.each([[0, 300, 60, 360], [1, 950, 190, 1140], [2, 1600, 320, 1920], [3, 3300, 660, 3960]])('quotes pack %i without changing the original pack', (index, baseCredits, bonusCredits, credits) => {
    const pack = creditPacks[index];
    expect(getCreditPackOffer(pack, Date.parse('2026-11-27T12:00:00Z'))).toEqual({ baseCredits, bonusCredits, credits, campaignId: 'black-friday-2026' });
    expect(pack.credits).toBe(baseCredits);
  });
  it('uses the current clock when no date is supplied', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
    expect(getBlackFridayStatus()).toBe('active');
    expect(getCreditPackOffer(creditPacks[0]).credits).toBe(360);
  });
  it.each([[300, 60, 360], [1200, 240, 1440], [2200, 440, 2640], [5000, 1000, 6000]])('validates a saved historical %i-credit quote without using the new catalog', (base, bonus, total) => {
    expect(matchesCreditPackOfferMetadata({ baseCredits: String(base), bonusCredits: String(bonus), campaignId: 'black-friday-2026' }, total)).toBe(true);
    expect(matchesCreditPackOfferMetadata({ baseCredits: String(base), bonusCredits: String(bonus / 2), campaignId: 'black-friday-2026' }, base + bonus / 2)).toBe(false);
  });

  it('continues validating historical 20% orders when new checkouts use a later 10% campaign', () => {
    // Simulate selecting a later campaign without scheduling one in production.
    const source = readFileSync(new URL('../content/black-friday-offer.ts', import.meta.url), 'utf8');
    const future = { id: 'future-test-campaign', year: 2027, bonusPercent: 10, startsAt: '2027-11-20T00:00:00.000Z', endsAt: '2027-12-02T00:00:00.000Z' };
    const replaced = source.replace(/export const blackFridayCampaign = [\s\S]*?;\n/, `export const blackFridayCampaign = ${JSON.stringify(future)} as const;\n`);
    const module = { exports: {} as typeof import('../content/black-friday-offer') };
    runInNewContext(transformSync(replaced, { loader: 'ts', format: 'cjs' }).code, { module });
    expect(module.exports.getCreditPackOffer(creditPacks[0], Date.parse('2027-11-27T00:00:00Z')).credits).toBe(330);
    expect(module.exports.matchesCreditPackOfferMetadata({ baseCredits: '1200', bonusCredits: '240', campaignId: 'black-friday-2026' }, 1440)).toBe(true);
    expect(module.exports.matchesCreditPackOfferMetadata({ baseCredits: '1200', bonusCredits: '120', campaignId: 'black-friday-2026' }, 1320)).toBe(false);
  });
});

describe('future credit pack campaign policy', () => {
  const futureCampaign = { id: 'future-test-campaign', year: 2027, bonusPercent: 10, startsAt: '2027-11-20T00:00:00.000Z', endsAt: '2027-12-02T00:00:00.000Z' };

  it.each([11, 20, 40])('rejects a new campaign with %i percent bonus credits', bonusPercent => {
    expect(() => createCreditPackCampaignRegistry([{ ...futureCampaign, bonusPercent }])).toThrow('10%');
  });

  it('accepts a 10% future campaign while retaining the published 2026 contract', () => {
    const registry = createCreditPackCampaignRegistry([futureCampaign]);
    expect(registry[futureCampaign.id]).toEqual(futureCampaign);
    expect(registry['black-friday-2026']).toEqual({
      id: 'black-friday-2026', year: 2026, bonusPercent: 20,
      startsAt: '2026-11-20T00:00:00.000Z', endsAt: '2026-12-02T00:00:00.000Z',
    });
  });

  it('rejects replacing the published campaign or stacking duplicate campaign definitions', () => {
    expect(() => createCreditPackCampaignRegistry([{ ...futureCampaign, id: 'black-friday-2026' }])).toThrow('already registered');
    expect(() => createCreditPackCampaignRegistry([futureCampaign, futureCampaign])).toThrow('already registered');
  });
});
