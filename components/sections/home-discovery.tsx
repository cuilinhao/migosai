import { ArrowRight } from "lucide-react";
import Link from "@/components/i18n/localized-link";
import { HomeDiscoveryGrid, type HomeDiscoveryItem } from "@/components/home-discovery-grid";
import { daysUntil, getHomeDiscoveryCards, type DiscoveryCard, type DiscoveryKind } from "@/content/home-discovery";
import { localeTags } from "@/lib/i18n/routing";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { translateHomeDiscoveryTitle } from "@/lib/i18n/messages/home-discovery";

const kindLabels: Record<DiscoveryKind, string> = { generator: "Generator", effect: "Video effect", template: "Video template", offer: "Offer", guide: "Guide" };
const badgeLabels = { limited: "Limited", "coming-soon": "Starts soon", new: "New" } as const;

/**
 * Secondary "explore more" section placed after the final CTA, below all Hotel Lobby content.
 * One H2 only; card titles are not headings, so the page outline keeps its Hotel Lobby focus.
 */
export async function HomeDiscovery({ now }: { now: number }) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const cards = getHomeDiscoveryCards(now);
  if (!cards.length) return null;
  const date = (value: number) => new Intl.DateTimeFormat(localeTags[locale], { month: "short", day: "numeric", timeZone: "UTC" }).format(value);
  const items: HomeDiscoveryItem[] = cards.map((card: DiscoveryCard) => {
    const campaign = card.campaign && card.campaignState ? card.campaign : null;
    const days = campaign ? daysUntil(campaign.endsAt, now) : 0;
    return {
      href: card.path,
      title: translateHomeDiscoveryTitle(card.title, locale, t),
      blurb: t(card.blurb),
      poster: card.poster,
      video: card.video,
      type: t(kindLabels[card.kind]),
      badge: card.badge ? { kind: card.badge, label: card.badge === "season" ? t(card.season?.label ?? "") : t(badgeLabels[card.badge]) } : null,
      meta: !campaign ? t(kindLabels[card.kind])
        : card.campaignState === "active" ? (days <= 1 ? t("Last day") : t("{count} days left", { count: days }))
        : t("Starts {date}", { date: date(Date.parse(campaign.startsAt)) }),
      campaign: !!campaign,
      cta: t(campaign ? "See the offer" : "Try it"),
      offer: campaign ? { amount: `+${campaign.bonusPercent}%`, label: t("bonus credits"), dates: `${date(Date.parse(campaign.startsAt))} – ${date(Date.parse(campaign.endsAt) - 1)}` } : undefined,
    };
  });
  return <section id="more-ai-video-tools" className="home-discovery" data-nosnippet="" aria-labelledby="home-discovery-title">
    <div className="section-container">
      <div className="home-discovery-head">
        <div>
          <p className="eyebrow">{t("More from MigosAI")}</p>
          <h2 id="home-discovery-title">{t("Explore more AI video tools")}</h2>
        </div>
        <Link className="home-discovery-all" href="/tools">{t("View all tools")}<ArrowRight size={15} aria-hidden="true"/></Link>
      </div>
      <HomeDiscoveryGrid items={items}/>
    </div>
  </section>;
}
