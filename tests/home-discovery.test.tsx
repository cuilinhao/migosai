import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import { SiteShell } from "../components/site-shell";
import { AuthProvider } from "../components/auth-provider";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { getMessages, locales, localizeHref, type Locale } from "../lib/i18n";
import { homeDiscoveryRows } from "../lib/i18n/messages/home-discovery";
import { publicPages } from "../content/public-pages";
import { videoEffects } from "../content/effects";
import { getEffectCreationHref } from "../content/effect-templates";
import { blackFridayCampaign } from "../content/black-friday-offer";
import {
  campaignBarCookieValue, discoveryPages, footerGroups, getCampaignBar, getFooterDiscoveryColumns, getHomeDiscoveryCards, HOME_DISCOVERY_SLOTS,
} from "../content/home-discovery";

const request = vi.hoisted(() => ({ locale: "en", path: "/" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-migos-locale": request.locale, "x-migos-pathname": request.path }) }));
vi.mock("next/navigation", () => ({ usePathname: () => request.path }));

async function resolveServerNodes(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(async (child, index) => {
    const resolved = await resolveServerNodes(child);
    return isValidElement(resolved) && resolved.key == null ? cloneElement(resolved, { key: `server-${index}` }) : resolved;
  }));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function" && element.type.constructor.name === "AsyncFunction") {
    return resolveServerNodes(await (element.type as (props: typeof element.props) => Promise<ReactNode>)(element.props));
  }
  return element.props.children === undefined ? element : cloneElement(element, undefined, await resolveServerNodes(element.props.children));
}

async function renderHome(locale: Locale = "en", campaignBar: ReturnType<typeof getCampaignBar> = null, now = PREVIEW) {
  request.locale = locale; request.path = "/";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  try {
    const page = await resolveServerNodes(await HomePage());
    return renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><AuthProvider><SiteShell campaignBar={campaignBar}>{page}</SiteShell></AuthProvider></LocaleProvider>);
  } finally {
    vi.useRealTimers();
  }
}

const at = (iso: string) => Date.parse(iso);
const PREVIEW = at("2026-10-25T04:00:00Z"), LIVE = at("2026-11-27T04:00:00Z"), AFTER = at("2026-12-05T04:00:00Z");
// The homepage's indexed section headings (translation source keys), in order. New sections may only be appended after them.
const ORIGINAL_H2 = [
  "Hotel Lobby AI Video Generator", "The Hotel Lobby look", "What is the Hotel Lobby AI video trend?", "Hotel Lobby AI Videos Made with LobbyDuo",
  "Hotel Lobby AI video examples", "Vertical Hotel Lobby AI videos for TikTok and Reels", "How to Make a Hotel Lobby AI Video in Three Steps",
  "What You Get with This Hotel Lobby AI Video Maker", "Hotel Lobby AI Video FAQs", "LobbyDuo Pricing and Credit Plans", "Ready to make your Hotel Lobby AI video?",
];
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").trim();

describe("homepage discovery registry", () => {
  const effectRoutes = new Map(videoEffects.map(effect => [getEffectCreationHref(effect), effect]));
  const liveRoutes = new Set([...publicPages.map(page => page.path), ...effectRoutes.keys()]);

  it("only promotes live routes and existing media", () => {
    for (const page of discoveryPages) {
      expect(liveRoutes.has(page.path), page.path).toBe(true);
      for (const asset of [page.poster, page.video]) if (asset) expect(existsSync(`public${asset}`), asset).toBe(true);
      if (page.poster) expect(page.blurb, page.path).toBeTruthy();
      const effect = effectRoutes.get(page.path);
      if (effect && page.kind === "effect") expect(page.title).toBe(effect.title);
    }
    for (const column of getFooterDiscoveryColumns()) for (const link of column.links) expect(link.path === "/effects" || liveRoutes.has(link.path), link.path).toBe(true);
  });

  it("uses the Black Friday offer contract for its dates and bonus", () => {
    const page = discoveryPages.find(item => item.path === "/black-friday");
    expect(page?.campaign).toMatchObject({ id: blackFridayCampaign.id, startsAt: blackFridayCampaign.startsAt, endsAt: blackFridayCampaign.endsAt, bonusPercent: blackFridayCampaign.bonusPercent });
  });

  it("translates every new piece of copy into every locale", () => {
    for (const row of homeDiscoveryRows) expect(row.every(Boolean), row[0]).toBe(true);
    const keys = new Set(homeDiscoveryRows.map(row => row[0]));
    const required = [
      ...discoveryPages.flatMap(page => page.blurb ? [page.blurb] : []),
      ...discoveryPages.filter(page => page.kind === "guide").map(page => page.title),
      ...footerGroups.flatMap(group => [group.title, ...(group.more ? [group.more.label] : [])]),
    ];
    for (const locale of locales.filter(locale => locale !== "en")) {
      const messages = getMessages(locale);
      for (const key of required) expect(keys.has(key) || key in messages, `${locale}: ${key}`).toBe(true);
      for (const key of required) expect(messages[key], `${locale}: ${key}`).toBeTruthy();
    }
  });

  it("orders cards by live offer, season, freshness and priority, and drops expired ones", () => {
    const preview = getHomeDiscoveryCards(PREVIEW);
    expect(preview).toHaveLength(HOME_DISCOVERY_SLOTS);
    expect(preview[0]).toMatchObject({ path: "/black-friday", badge: "coming-soon", campaignState: "upcoming" });
    expect(preview.slice(1, 3).map(card => card.badge)).toEqual(["season", "season"]);

    const live = getHomeDiscoveryCards(LIVE);
    expect(live[0]).toMatchObject({ path: "/black-friday", badge: "limited", campaignState: "active" });
    expect(live.some(card => card.season)).toBe(false);
    expect(live.some(card => card.badge === "new")).toBe(false);

    const after = getHomeDiscoveryCards(AFTER);
    expect(after.some(card => card.path === "/black-friday")).toBe(false);
    expect(after.length).toBeLessThanOrEqual(HOME_DISCOVERY_SLOTS);
  });

  it("announces one campaign until it ends and honours a dismissal of the current stage only", () => {
    expect(getCampaignBar(at("2026-10-24T23:59:59Z"))).toBeNull();
    const upcoming = getCampaignBar(PREVIEW);
    expect(upcoming).toMatchObject({ state: "upcoming", path: "/black-friday", bonusPercent: 20 });
    expect(getCampaignBar(PREVIEW, campaignBarCookieValue(upcoming!))).toBeNull();
    // Dismissing the preview does not hide the bar once the offer goes live.
    expect(getCampaignBar(LIVE, campaignBarCookieValue(upcoming!))).toMatchObject({ state: "active" });
    expect(getCampaignBar(at(blackFridayCampaign.endsAt))).toBeNull();
    expect(getCampaignBar(AFTER)).toBeNull();
  });
});

describe("homepage SEO is preserved", () => {
  it.each(locales)("keeps every original heading in order and appends one secondary section after the final CTA in %s", async locale => {
    const html = await renderHome(locale, getCampaignBar(LIVE), LIVE);
    const messages = getMessages(locale);
    const translate = (source: string) => (messages[source] ?? source).replaceAll("LobbyDuo", "MigosAI");
    const h2 = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(match => text(match[1]));
    expect(h2.slice(0, ORIGINAL_H2.length)).toEqual(ORIGINAL_H2.map(source => text(renderToStaticMarkup(<>{translate(source)}</>))));
    expect(h2.slice(ORIGINAL_H2.length)).toEqual([text(renderToStaticMarkup(<>{translate("Explore more AI video tools")}</>))]);
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).not.toContain('type="application/ld+json"');

    const main = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/)![1];
    const section = main.match(/<section id="more-ai-video-tools"[\s\S]*<\/section>\s*$/)?.[0] ?? "";
    expect(section).toContain("data-nosnippet");
    expect(section).not.toMatch(/<h[13-6]\b/);
    expect(main.indexOf('id="cta"')).toBeLessThan(main.indexOf('id="more-ai-video-tools"'));
    expect(section.match(/class="home-discovery-card"/g)?.length).toBeLessThanOrEqual(HOME_DISCOVERY_SLOTS);
    expect(section).toContain(`href="${localizeHref("/black-friday", locale)}"`);
    expect(section).toMatch(/<img src="\/posters\/home-discovery\/[^"]+" alt="" width="480" height="600" loading="lazy"/);
    expect(section).not.toContain("<video");
  });

  it.each(locales)("renders the campaign bar as header chrome without headings in %s", async locale => {
    const html = await renderHome(locale, getCampaignBar(PREVIEW));
    const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)![0];
    expect(header).toMatch(/^<header class="site-header"/);
    expect(header).toContain('class="campaign-bar" data-nosnippet=""');
    expect(header).not.toMatch(/<h[1-6]\b/);
    expect(header).toContain(`href="${localizeHref("/black-friday", locale)}"`);
    expect(html).toContain('class="hotel-lobby-home" data-campaign-bar=""');
    if (locale !== "en") expect(header).toContain(getMessages(locale)["See the offer"]);
  });

  it("renders the original homepage chrome when no campaign is announced", async () => {
    const html = await renderHome("en", getCampaignBar(AFTER), AFTER);
    expect(html).toContain('<div class="hotel-lobby-home"><header class="site-header">');
    expect(html).not.toContain("campaign-bar");
  });

  it.each(locales)("keeps the original footer columns and appends the new links without headings in %s", async locale => {
    const html = await renderHome(locale);
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)![1];
    const messages = getMessages(locale);
    expect([...footer.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(match => match[1])).toEqual([messages.Product ?? "Product", "Hotel Lobby AI", messages.Link ?? "Link"]);
    const more = footer.match(/<nav class="footer-more"[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(more).not.toMatch(/<h[1-6]\b/);
    for (const column of getFooterDiscoveryColumns()) for (const link of column.links) expect(more).toContain(`href="${localizeHref(link.path, locale)}"`);
    expect(footer.indexOf('class="footer-top"')).toBeLessThan(footer.indexOf('class="footer-more"'));
  });
});

describe("homepage discovery localization and campaign stages", () => {
  const scopedTitles = [
    "Flying Car AI Generator", "Ozil Goal Generator", "Ramalama Costume Walk", "Money Flex",
    "Hit The Road Dude AI Video", "Zombie Love Story", "Pet Diva Dance",
  ];
  const flyingCarTitles = {
    "zh-TW": "飛天汽車 AI 產生器", ko: "플라잉카 AI 생성기", ja: "空飛ぶ車AI生成ツール",
    fr: "Générateur IA de voiture volante", es: "Generador de coches voladores con IA",
  };

  it.each(locales.filter(locale => locale !== "en"))("localizes every discovery title without changing existing navigation in %s", async locale => {
    const html = await renderHome(locale);
    const section = html.match(/<section id="more-ai-video-tools"[\s\S]*?<\/section>/)![0];
    const more = html.match(/<nav class="footer-more"[\s\S]*?<\/nav>/)![0];
    const header = html.match(/<header\b[\s\S]*?<\/header>/)![0];
    const footerLabels = new Map([...more.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(match => [match[1], text(match[2])]));
    const cardLabels = new Map([...section.matchAll(/<a class="home-discovery-card"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span class="home-discovery-title">([\s\S]*?)<\/span>/g)].map(match => [match[1], text(match[2])]));

    for (const source of scopedTitles) {
      const page = discoveryPages.find(page => page.title === source)!;
      const href = localizeHref(page.path, locale);
      const label = footerLabels.get(href);
      expect(label, `${locale}: ${source}`).toBeTruthy();
      expect(label, `${locale}: ${source}`).not.toBe(source);
      if (cardLabels.has(href)) expect(cardLabels.get(href)).toBe(label);
      // Discovery-only labels must not enter the shared dictionary used by existing pages.
      expect(getMessages(locale)[source], `${locale}: shared ${source}`).toBeUndefined();
    }
    expect(footerLabels.get(localizeHref("/flying-car-ai-video-generator", locale))).toBe(flyingCarTitles[locale]);
    expect(cardLabels.get(localizeHref("/flying-car-ai-video-generator", locale))).toBe(flyingCarTitles[locale]);
    expect(header).toContain("Flying Car AI Generator");
    expect(header).toContain("Ozil Goal Generator");
    expect(header).not.toContain(flyingCarTitles[locale]);
  });

  const stages = [
    { state: "upcoming", now: PREVIEW, badge: "coming-soon", seasonal: true },
    { state: "active", now: LIVE, badge: "limited", seasonal: false },
    { state: "ended", now: AFTER, badge: null, seasonal: false },
  ] as const;
  it.each(locales.flatMap(locale => stages.map(stage => ({ locale, ...stage }))))("renders $state campaign and seasonal visibility consistently in $locale", async ({ locale, state, now, badge, seasonal }) => {
    const html = await renderHome(locale, getCampaignBar(now), now);
    const section = html.match(/<section id="more-ai-video-tools"[\s\S]*?<\/section>/)![0];
    const header = html.match(/<header\b[\s\S]*?<\/header>/)![0];
    const more = html.match(/<nav class="footer-more"[\s\S]*?<\/nav>/)![0];
    const offerLink = `href="${localizeHref("/black-friday", locale)}"`;
    if (badge) {
      expect(section).toContain(offerLink);
      expect(section).toContain(`data-badge="${badge}"`);
      expect(header).toContain(`data-state="${state}"`);
    } else {
      expect(section).not.toContain(offerLink);
      expect(header).not.toContain('class="campaign-bar"');
    }
    expect(section.includes('data-badge="season"')).toBe(seasonal);
    expect(more).toContain(offerLink);
    expect(more).toContain(`href="${localizeHref("/effects/011-ramalama-costume-walk", locale)}"`);
  });
});
