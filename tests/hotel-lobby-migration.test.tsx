import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HotelLobbyPage, { generateMetadata } from "../app/hotel-lobby-ai-video-generator/page";
import { AuthProvider } from "../components/auth-provider";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { getMessages, locales, localizeHref, type Locale } from "../lib/i18n";
import { homeFaqItems, workflowSteps, featureItems } from "../content/home";
import { hotelLobbyFaqs, hotelLobbySteps } from "../content/hotel-lobby";

const request = vi.hoisted(() => ({ locale: "en", path: "/hotel-lobby-ai-video-generator" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-migos-locale": request.locale, "x-migos-pathname": request.path }) }));
vi.mock("next/navigation", () => ({ usePathname: () => request.path }));

// Resolve async server components while leaving client components to React's real renderer.
async function resolveServerNodes(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(async (child, index) => {
    const resolved = await resolveServerNodes(child);
    return isValidElement(resolved) && resolved.key == null ? cloneElement(resolved, { key: `server-${index}` }) : resolved;
  }));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function" && element.type.constructor.name === "AsyncFunction") {
    const render = element.type as (props: typeof element.props) => Promise<ReactNode>;
    return resolveServerNodes(await render(element.props));
  }
  return element.props.children === undefined ? element : cloneElement(element, undefined, await resolveServerNodes(element.props.children));
}

async function renderPage(locale: Locale = "en") {
  request.locale = locale;
  const page = await resolveServerNodes(await HotelLobbyPage());
  return renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><AuthProvider>{page}</AuthProvider></LocaleProvider>);
}

describe("complete Hotel Lobby landing migration", () => {
  it("keeps the original hero, examples, generator, workflow, features, FAQs, credit packs and CTA together", async () => {
    const html = await renderPage();
    expect(html).toContain("Make Your Own Hotel Lobby Video with AI");
    expect(html).toContain("/videos/home-hero/reel/site-grandma-and-grandson.mp4");
    expect(html).toContain("MigosAI is built for that two-person setup.");
    expect(html).toContain("Hotel Lobby AI Videos Made with MigosAI");
    expect(html).toContain("Hotel Lobby AI video examples");
    expect(html).toContain("Third-party clip, not made with MigosAI");
    expect(html.match(/id="mi-left-photo"/g)).toHaveLength(1);
    expect(html.match(/id="mi-right-photo"/g)).toHaveLength(1);
    for (const { title, description } of [...workflowSteps, ...featureItems]) {
      expect(html).toContain(renderToStaticMarkup(<>{title}</>));
      expect(html).toContain(renderToStaticMarkup(<>{description}</>));
    }
    for (const { question, answer } of homeFaqItems) {
      expect(html).toContain(renderToStaticMarkup(<>{question.replaceAll('LobbyDuo', 'MigosAI')}</>));
      expect(html).toContain(renderToStaticMarkup(<>{answer.replaceAll('LobbyDuo', 'MigosAI')}</>));
    }
    expect(html).toContain("MigosAI Pricing and Credit Plans");
    expect(html).toContain("Buy Starter");
    expect(html).toContain("Buy Creator");
    expect(html).toContain("Ready to make your Hotel Lobby AI video?");
    expect(html.match(/id="generator"/g)).toHaveLength(1);
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html.match(/class="mi-showcase-grid/g)).toHaveLength(1);
    const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).not.toMatch(/href="\/#(?:generator|features|faq|how-it-works)"/);
    expect(html).toContain('href="/hotel-lobby-ai-video-generator#generator"');
  });

  it.each(locales)("preserves independent SEO content, all existing translations and canonical in %s", async (locale) => {
    const html = await renderPage(locale);
    const messages = getMessages(locale);
    const text = (source: string) => renderToStaticMarkup(<>{(messages[source] ?? source).replaceAll('LobbyDuo', 'MigosAI').replaceAll('LOBBYDUO', 'MIGOSAI')}</>);
    expect(html).toContain(text("Make Your Own Hotel Lobby Video with AI"));
    for (const item of [...workflowSteps, ...featureItems, ...homeFaqItems]) {
      for (const source of Object.values(item)) expect(html).toContain(text(source));
    }
    expect(html).toContain(text("Photo requirements & best results"));
    expect(html).toContain(text("Hotel Lobby AI video generator vs. general-purpose AI video tools"));
    for (const { title, description } of hotelLobbySteps) {
      expect(html).toContain(text(title));
      expect(html).toContain(text(description));
    }
    for (const { question, answer } of hotelLobbyFaqs) {
      expect(html).toContain(text(question));
      expect(html).toContain(text(answer));
    }
    expect(html).toContain('href="https://www.youtube.com/watch?v=x9yop0nYR9g"');
    expect(html).toContain('href="https://www.media.io/ai/explore/zone/hotel-lobby-ai-video-trend"');
    expect(html).toContain(`href="${localizeHref("/hotel-lobby-ai-template", locale)}"`);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"SoftwareApplication"');
    expect(html).toContain('"@type":"FAQPage"');
    const metadata = await generateMetadata();
    expect(metadata.alternates?.canonical).toBe(`https://migosai.design${localizeHref("/hotel-lobby-ai-video-generator", locale)}`);
  });

  it.each(locales)("routes header and footer links to migrated sections in %s", (locale) => {
    const html = renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><AuthProvider><SiteHeader/><SiteFooter/></AuthProvider></LocaleProvider>);
    for (const anchor of ["how-it-works", "faq", "features"]) {
      expect(html).toContain(`href="${localizeHref(`/hotel-lobby-ai-video-generator#${anchor}`, locale)}"`);
    }
    expect(html).not.toMatch(/href="\/(?:ko\/|ja\/|fr\/|es\/|zh-TW\/)?#(?:features|faq|how-it-works)"/);
  });
});
