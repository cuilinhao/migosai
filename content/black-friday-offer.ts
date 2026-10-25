import type { creditPacks } from './pricing';

type CreditPackCampaign = Readonly<{
  id: string;
  year: number;
  bonusPercent: number;
  startsAt: string;
  endsAt: string;
}>;

// Never edit or remove historical rules:
// delayed payments and refund reviews must retain the original offer contract.
const historicalCreditPackCampaigns = Object.freeze({
  'black-friday-2026': Object.freeze({
    id: 'black-friday-2026',
    year: 2026,
    bonusPercent: 20,
    startsAt: '2026-11-20T00:00:00.000Z',
    endsAt: '2026-12-02T00:00:00.000Z',
  } as const),
});

/** New campaigns are capped at 10%; the published 2026 promise is grandfathered. */
export function createCreditPackCampaignRegistry(futureCampaigns: readonly CreditPackCampaign[]) {
  const campaigns: Record<string, CreditPackCampaign> = { ...historicalCreditPackCampaigns };
  for (const campaign of futureCampaigns) {
    if (Object.hasOwn(campaigns, campaign.id)) throw new Error(`Campaign ${campaign.id} is already registered.`);
    if (!Number.isFinite(campaign.bonusPercent) || campaign.bonusPercent <= 0 || campaign.bonusPercent > 10) {
      throw new Error('New credit pack campaigns may offer at most 10% bonus credits.');
    }
    campaigns[campaign.id] = Object.freeze({ ...campaign });
  }
  return Object.freeze(campaigns);
}

// Register future campaigns here. A checkout uses only the one selected campaign,
// so bonuses are never combined; no future campaign is currently scheduled.
const creditPackCampaigns = createCreditPackCampaignRegistry([]);

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
