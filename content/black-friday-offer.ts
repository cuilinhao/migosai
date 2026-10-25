import type { creditPacks } from './pricing';

// Append future campaigns under new IDs. Never edit or remove historical rules:
// delayed payments and refund reviews must retain the original offer contract.
const creditPackCampaigns = Object.freeze({
  'black-friday-2026': Object.freeze({
    id: 'black-friday-2026',
    year: 2026,
    bonusPercent: 20,
    startsAt: '2026-11-20T00:00:00.000Z',
    endsAt: '2026-12-02T00:00:00.000Z',
  } as const),
});

export const blackFridayCampaign = creditPackCampaigns['black-friday-2026'];

export function getBlackFridayStatus(now: Date | number = Date.now()): 'upcoming' | 'active' | 'ended' {
  const timestamp = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(timestamp) || timestamp >= Date.parse(blackFridayCampaign.endsAt)) return 'ended';
  return timestamp < Date.parse(blackFridayCampaign.startsAt) ? 'upcoming' : 'active';
}

/** Quote once when checkout is created; fulfillment uses the saved order total. */
export function getCreditPackOffer(pack: typeof creditPacks[number], now: Date | number = Date.now()) {
  const active = getBlackFridayStatus(now) === 'active';
  const bonusCredits = active ? Math.floor(pack.credits * blackFridayCampaign.bonusPercent / 100) : 0;
  return {
    baseCredits: pack.credits,
    bonusCredits,
    credits: pack.credits + bonusCredits,
    campaignId: active ? blackFridayCampaign.id : null,
  };
}

/** Validate saved provider metadata without re-quoting against today's date or packs. */
export function matchesCreditPackOfferMetadata(metadata: Record<string, unknown>, credits: number): boolean {
  if (metadata.baseCredits === undefined && metadata.bonusCredits === undefined && metadata.campaignId === undefined) return true; // Historical checkout.
  const base = Number(metadata.baseCredits), bonus = Number(metadata.bonusCredits);
  if (!Number.isSafeInteger(base) || base <= 0 || !Number.isSafeInteger(bonus) || bonus < 0 ||
    metadata.baseCredits !== String(base) || metadata.bonusCredits !== String(bonus) || base + bonus !== credits) return false;
  if (bonus === 0) return metadata.campaignId === undefined;
  if (typeof metadata.campaignId !== 'string' || !Object.hasOwn(creditPackCampaigns, metadata.campaignId)) return false;
  const campaign = creditPackCampaigns[metadata.campaignId as keyof typeof creditPackCampaigns];
  return bonus === Math.floor(base * campaign.bonusPercent / 100);
}
