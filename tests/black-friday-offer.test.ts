import { afterEach, describe, expect, it, vi } from 'vitest';
import { creditPacks } from '../content/pricing';
import { getBlackFridayStatus, getCreditPackOffer } from '../content/black-friday-offer';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { runInNewContext } from 'node:vm';

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
  it.each([[0, 300, 60, 360], [1, 1200, 240, 1440], [2, 2200, 440, 2640], [3, 5000, 1000, 6000]])('quotes pack %i without changing the original pack', (index, baseCredits, bonusCredits, credits) => {
    const pack = creditPacks[index];
    expect(getCreditPackOffer(pack, Date.parse('2026-11-27T12:00:00Z'))).toEqual({ baseCredits, bonusCredits, credits, campaignId: 'black-friday-2026' });
    expect(pack.credits).toBe(baseCredits);
  });
  it('uses the current clock when no date is supplied', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
    expect(getBlackFridayStatus()).toBe('active');
    expect(getCreditPackOffer(creditPacks[0]).credits).toBe(360);
  });
  it('still validates a 2026 order when a later campaign is selected for new checkouts', () => {
    // Execute the real module with only its selected campaign replaced, as a
    // future rollout would do. Historical order rules must survive that change.
    const source = readFileSync(new URL('../content/black-friday-offer.ts', import.meta.url), 'utf8');
    const future = { id: 'black-friday-2027', year: 2027, bonusPercent: 40, startsAt: '2027-11-20T00:00:00.000Z', endsAt: '2027-12-02T00:00:00.000Z' };
    const replaced = source.replace(/export const blackFridayCampaign = [\s\S]*?;\n/, `export const blackFridayCampaign = ${JSON.stringify(future)} as const;\n`);
    const module = { exports: {} as typeof import('../content/black-friday-offer') };
    runInNewContext(transformSync(replaced, { loader: 'ts', format: 'cjs' }).code, { module });
    expect(module.exports.getCreditPackOffer(creditPacks[0], Date.parse('2027-11-27T00:00:00Z')).credits).toBe(420);
    expect(module.exports.matchesCreditPackOfferMetadata({ baseCredits: '300', bonusCredits: '60', campaignId: 'black-friday-2026' }, 360)).toBe(true);
    expect(module.exports.matchesCreditPackOfferMetadata({ baseCredits: '300', bonusCredits: '120', campaignId: 'black-friday-2026' }, 420)).toBe(false);
  });
});
