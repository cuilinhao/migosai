import { blackFridayCampaign } from './black-friday-offer';

/**
 * Registry of inner pages promoted from the homepage: the campaign bar in the header,
 * the "Explore more AI video tools" cards after the final CTA, and the extra footer row.
 *
 * Add a new inner page here once it is live. Titles and blurbs are English source copy;
 * add their translations to lib/i18n/messages/home-discovery.ts.
 * Never remove a page when its campaign or season ends: the selectors below hide expired
 * cards automatically, and the footer keeps linking to the page.
 */

export type DiscoveryKind = 'generator' | 'effect' | 'template' | 'offer' | 'guide';
export type FooterGroup = 'generators' | 'effects' | 'guides' | 'offers';

export type DiscoveryCampaign = {
  id: string;
  /** First moment the campaign is announced (bar and "Coming soon" card). */
  announceFrom: string;
  startsAt: string;
  /** Exclusive end, same convention as content/black-friday-offer.ts. */
  endsAt: string;
  bonusPercent: number;
};

export type DiscoveryPage = {
  path: string;
  title: string;
  /** One short line for the homepage card. Required when `poster` is set. */
  blurb?: string;
  kind: DiscoveryKind;
  /** 4:5 card image in /public. Pages without a poster are footer-only. */
  poster?: string;
  /** Muted preview played on hover. */
  video?: string;
  /** YYYY-MM-DD. Shows a "New" badge for NEW_BADGE_DAYS. */
  publishedAt?: string;
  /** Seasonal badge; the card leaves the homepage at `until`, the footer link stays. */
  season?: { label: string; until: string };
  campaign?: DiscoveryCampaign;
  /** Higher first among cards with the same status. */
  priority: number;
  /** Footer column; omit for pages the original footer already links to. */
  footer?: FooterGroup;
};

export type CampaignState = 'upcoming' | 'active';

export const HOME_DISCOVERY_SLOTS = 8;
export const NEW_BADGE_DAYS = 14;
export const CAMPAIGN_BAR_COOKIE = 'migos_campaign_bar';

export const blackFridayDiscoveryCampaign: DiscoveryCampaign = {
  id: blackFridayCampaign.id,
  announceFrom: '2026-10-25T00:00:00.000Z',
  startsAt: blackFridayCampaign.startsAt,
  endsAt: blackFridayCampaign.endsAt,
  bonusPercent: blackFridayCampaign.bonusPercent,
};

const HALLOWEEN_2026 = { label: 'Halloween', until: '2026-11-01T00:00:00.000Z' };

export const discoveryPages: readonly DiscoveryPage[] = [
  { path: '/black-friday', title: 'Black Friday 2026', blurb: 'Bonus credits on one-time credit packs', kind: 'offer',
    poster: '/posters/home-discovery/black-friday.webp', video: '/videos/lobbyduo/wan-3-corgi-cat.mp4',
    campaign: blackFridayDiscoveryCampaign, priority: 100, footer: 'offers' },
  { path: '/flying-car-ai-video-generator', title: 'Flying Car AI Generator', blurb: 'Turn a photo into a flying car video', kind: 'generator',
    poster: '/posters/home-discovery/flying-car.webp', video: '/flyingcar/real/overpass-launch.mp4',
    publishedAt: '2026-10-17', priority: 90, footer: 'generators' },
  { path: '/ozil-goal-generator', title: 'Ozil Goal Generator', blurb: 'Turn one photo into the viral Ozil goal video', kind: 'generator',
    poster: '/posters/home-discovery/ozil-goal.webp', video: '/ozil-goal/samples/ozil-goal-demo-ai.mp4',
    publishedAt: '2026-10-15', priority: 85, footer: 'generators' },
  { path: '/effects/011-ramalama-costume-walk', title: 'Ramalama Costume Walk', blurb: 'A Halloween runway walk down a lantern-lit hall', kind: 'effect',
    poster: '/posters/home-discovery/ramalama-costume-walk.webp', video: '/effects/piclumen/011-ramalama-costume-walk.mp4',
    publishedAt: '2026-10-22', season: HALLOWEEN_2026, priority: 70, footer: 'effects' },
  { path: '/effects/003-ai-money-flex', title: 'Money Flex', blurb: 'Fan out a stack of cash for the camera', kind: 'effect',
    poster: '/posters/home-discovery/money-flex.webp', video: '/effects/piclumen/003-ai-money-flex.mp4',
    publishedAt: '2026-10-22', priority: 60, footer: 'effects' },
  { path: '/ai-rap-song-generator', title: 'AI Rap Song Generator', blurb: 'Make a full rap song from a prompt or your lyrics', kind: 'generator',
    poster: '/posters/home-discovery/rap-song.webp', video: '/videos/lobbyduo/seedance-2-corgi-rap.mp4', priority: 55 },
  { path: '/effects/004-hit-the-road-dude-ai-video', title: 'Hit The Road Dude AI Video', blurb: 'Wave goodbye and walk off to a waiting car', kind: 'effect',
    poster: '/posters/home-discovery/hit-the-road-dude.webp', video: '/effects/piclumen/004-hit-the-road-dude-ai-video.mp4',
    publishedAt: '2026-10-22', priority: 50, footer: 'effects' },
  { path: '/hotel-lobby-ai-template', title: 'Hotel Lobby AI Template', blurb: 'The orange booth and one mic, ready for two photos', kind: 'template',
    poster: '/posters/home-discovery/hotel-lobby-template.webp', video: '/videos/hotel-lobby-examples/fuzana-grandparents.mp4', priority: 45 },
  { path: '/effects/017-zombie-love-story', title: 'Zombie Love Story', blurb: 'A sweet zombie-costume date on a foggy street', kind: 'effect',
    poster: '/posters/home-discovery/zombie-love-story.webp', video: '/effects/piclumen/017-zombie-love-story.mp4',
    publishedAt: '2026-10-22', season: HALLOWEEN_2026, priority: 40, footer: 'effects' },
  { path: '/hotel-lobby-ai-filter', title: 'Hotel Lobby AI Filter & Face Swap', blurb: 'Put two faces in the booth without filming', kind: 'template',
    poster: '/posters/home-discovery/hotel-lobby-filter.webp', video: '/videos/hotel-lobby-examples/lightx-woman-cat.mp4', priority: 35 },
  { path: '/effects/019-pet-dance', title: 'Pet Diva Dance', blurb: 'Your pet takes the stage as a dancing diva', kind: 'effect',
    poster: '/posters/home-discovery/pet-dance.webp', video: '/effects/piclumen/019-pet-dance.mp4', priority: 32, footer: 'effects' },
  { path: '/ai-image-generator', title: 'AI Image Generator', kind: 'generator', priority: 30, footer: 'generators' },
  { path: '/ai-video-generator', title: 'AI Video Generator', kind: 'generator', priority: 29, footer: 'generators' },
  { path: '/flying-car-ai-video-generator/how-to-make-a-tesla-roadster-flying-car-video', title: 'How to Make a Flying Car Video', kind: 'guide', priority: 20, footer: 'guides' },
  { path: '/flying-car-ai-video-generator/tesla-flying-car-ai-video-trend', title: 'Tesla Flying Car AI Video Trend', kind: 'guide', priority: 19, footer: 'guides' },
  { path: '/ozil-goal-generator/ozil-goal-ai-prompt', title: 'Ozil Goal AI Prompt', kind: 'guide', priority: 18, footer: 'guides' },
  { path: '/ozil-goal-generator/ozil-goal-trend', title: 'Ozil Goal Trend', kind: 'guide', priority: 17, footer: 'guides' },
  { path: '/blog/what-is-hotel-lobby-ai-video', title: 'What Is a Hotel Lobby AI Video?', kind: 'guide', priority: 16, footer: 'guides' },
];

const DAY = 86_400_000;
const time = (value: string) => Date.parse(value);

export function getCampaignState(campaign: DiscoveryCampaign, now: number): CampaignState | null {
  if (!Number.isFinite(now) || now >= time(campaign.endsAt) || now < time(campaign.announceFrom)) return null;
  return now >= time(campaign.startsAt) ? 'active' : 'upcoming';
}

export function isNewPage(page: DiscoveryPage, now: number): boolean {
  if (!page.publishedAt) return false;
  const published = time(`${page.publishedAt}T00:00:00.000Z`);
  return now >= published && now - published < NEW_BADGE_DAYS * DAY;
}

export function isInSeason(page: DiscoveryPage, now: number): boolean {
  return !!page.season && now < time(page.season.until);
}

/** Whole days until `target`, rounded up so the last partial day still counts as one. */
export function daysUntil(target: string, now: number): number {
  return Math.max(0, Math.ceil((time(target) - now) / DAY));
}

export type DiscoveryBadge = 'limited' | 'coming-soon' | 'season' | 'new' | null;

export type DiscoveryCard = DiscoveryPage & { poster: string; blurb: string; badge: DiscoveryBadge; campaignState: CampaignState | null };

/** Homepage cards: live offer → announced offer → in season → new → priority. Expired items drop out. */
export function getHomeDiscoveryCards(now: number, pages: readonly DiscoveryPage[] = discoveryPages): DiscoveryCard[] {
  return pages
    .filter((page): page is DiscoveryPage & { poster: string; blurb: string } => !!page.poster && !!page.blurb)
    .flatMap(page => {
      const campaignState = page.campaign ? getCampaignState(page.campaign, now) : null;
      if (page.campaign && !campaignState) return [];
      if (page.season && !isInSeason(page, now)) return [];
      const inSeason = isInSeason(page, now), fresh = isNewPage(page, now);
      const badge: DiscoveryBadge = campaignState === 'active' ? 'limited' : campaignState === 'upcoming' ? 'coming-soon' : inSeason ? 'season' : fresh ? 'new' : null;
      const rank = (campaignState === 'active' ? 4000 : campaignState === 'upcoming' ? 3000 : 0) + (inSeason ? 600 : 0) + (fresh ? 500 : 0) + page.priority;
      return [{ card: { ...page, badge, campaignState }, rank }];
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, HOME_DISCOVERY_SLOTS)
    .map(({ card }) => card);
}

export type CampaignBarData = {
  id: string;
  state: CampaignState;
  path: string;
  title: string;
  bonusPercent: number;
  startsAt: string;
  endsAt: string;
  /** Server render time, so the server and the browser show the same countdown. */
  now: number;
};

export const campaignBarCookieValue = (bar: Pick<CampaignBarData, 'id' | 'state'>) => `${bar.id}:${bar.state}`;

/** The single campaign announced in the homepage header, unless the visitor dismissed this stage of it. */
export function getCampaignBar(now: number, dismissed?: string | null, pages: readonly DiscoveryPage[] = discoveryPages): CampaignBarData | null {
  for (const page of pages) {
    if (!page.campaign) continue;
    const state = getCampaignState(page.campaign, now);
    if (!state) continue;
    const bar: CampaignBarData = { id: page.campaign.id, state, path: page.path, title: page.title, bonusPercent: page.campaign.bonusPercent, startsAt: page.campaign.startsAt, endsAt: page.campaign.endsAt, now };
    return dismissed === campaignBarCookieValue(bar) ? null : bar;
  }
  return null;
}

export const footerGroups: readonly { group: FooterGroup; title: string; more?: { path: string; label: string } }[] = [
  { group: 'generators', title: 'AI Generators' },
  { group: 'effects', title: 'Video Effects', more: { path: '/effects', label: 'All video effects' } },
  { group: 'guides', title: 'Guides' },
  { group: 'offers', title: 'Offers' },
];

/** Footer links never depend on the date, so campaign and seasonal pages stay linked after they end. */
export function getFooterDiscoveryColumns(pages: readonly DiscoveryPage[] = discoveryPages) {
  return footerGroups.map(({ group, title, more }) => ({
    group,
    title,
    links: [
      ...pages.filter(page => page.footer === group).sort((a, b) => b.priority - a.priority).map(page => ({ path: page.path, label: page.title })),
      ...(more ? [{ path: more.path, label: more.label }] : []),
    ],
  }));
}
