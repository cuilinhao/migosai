import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage, { generateMetadata as homeMetadata } from "../app/page";
import { SiteShell } from "../components/site-shell";
import HotelLobbyPage, { generateMetadata } from "../app/hotel-lobby-ai-video-generator/page";
import { AuthProvider } from "../components/auth-provider";
import { LocaleProvider } from "../components/i18n/locale-provider";
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

async function renderPage(locale: Locale = "en", home = false) {
  request.locale = locale;
  request.path = home ? "/" : "/hotel-lobby-ai-video-generator";
  const page = await resolveServerNodes(await (home ? HomePage() : HotelLobbyPage()));
  return renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><AuthProvider><SiteShell>{page}</SiteShell></AuthProvider></LocaleProvider>);
}

const historicalSeo: [Locale, string, string][] = [
  ["en", "Hotel Lobby AI Video Generator | LobbyDuo", "Create Hotel Lobby–style AI duo videos from two photos with LobbyDuo."],
  ["ko", "Hotel Lobby AI 동영상 생성기 | LobbyDuo", "LobbyDuo로 사진 두 장을 Hotel Lobby 스타일의 AI 듀오 동영상으로 만들어 보세요."],
  ["ja", "Hotel Lobby AI動画生成ツール | LobbyDuo", "LobbyDuoで2枚の写真からHotel LobbyスタイルのAIデュオ動画を作成。"],
  ["fr", "Générateur vidéo IA Hotel Lobby | LobbyDuo", "Créez des vidéos de duo dans le style Hotel Lobby à partir de deux photos avec LobbyDuo."],
  ["es", "Generador de vídeos con IA Hotel Lobby | LobbyDuo", "Crea vídeos de dúos al estilo Hotel Lobby a partir de dos fotos con LobbyDuo."],
  ["zh-TW", "Hotel Lobby AI 影片產生器 | LobbyDuo", "使用 LobbyDuo，將兩張照片製作成 Hotel Lobby 風格的 AI 雙人影片。"],
];

describe("Hotel Lobby homepage SEO restoration", () => {
  it.each(historicalSeo)("preserves the exact indexed %s title and description despite the visible rebrand", async (locale, title, description) => {
    request.locale = locale; request.path = "/";
    const metadata = await homeMetadata();
    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.description).toBe(description);
    expect(metadata.alternates?.canonical).toBe(`https://migosai.design${locale === "en" ? "/" : "/" + locale}`);
    expect(metadata.alternates?.languages).toEqual({
      en: "https://migosai.design/", ko: "https://migosai.design/ko", ja: "https://migosai.design/ja",
      fr: "https://migosai.design/fr", es: "https://migosai.design/es", "zh-TW": "https://migosai.design/zh-TW", "x-default": "https://migosai.design/",
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("serves the complete original homepage with the working generator and current purchase options", async () => {
    const html = await renderPage("en", true);
    expect(html).toContain("Make Your Own Hotel Lobby Video with AI");
    for (const clip of ["grandma-and-grandson", "best-friends", "man-and-dog", "young-couple"]) expect(html).toContain(`/videos/home-hero/reel/site-${clip}.mp4`);
    expect(html).toContain("MigosAI is built for that two-person setup.");
    expect(html).toContain("Hotel Lobby AI Videos Made with MigosAI");
    expect(html).toContain("Hotel Lobby AI video examples");
    expect(html).toContain("Third-party clip, not made with MigosAI");
    for (const id of ["mi-left-photo", "mi-right-photo", "generator", "features", "how-it-works", "faq"]) expect(html.match(new RegExp(`id="${id}"`, "g"))).toHaveLength(1);
    for (const item of [...workflowSteps, ...featureItems, ...homeFaqItems]) for (const text of Object.values(item)) expect(html).toContain(renderToStaticMarkup(<>{text.replaceAll("LobbyDuo", "MigosAI")}</>));
    expect(html).toContain("MigosAI Pricing and Credit Plans");
    expect(html).toContain("Buy Starter"); expect(html).toContain("Buy Creator");
    expect(html).toContain("One-time credit packs and subscription plans");
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).not.toContain("No subscription");
    expect(html).toContain("Ready to make your Hotel Lobby AI video?");
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html.match(/<main(?:\s|>)/g)).toHaveLength(1);
    expect(html.match(/<footer(?:\s|>)/g)).toHaveLength(1);
    expect(html).toContain('class="site-header"');
    expect(html).not.toContain('class="portal-sidebar"');
    expect(html).not.toContain('type="application/ld+json"');
    const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(locales)("keeps the original localized home anchors and visible internal links in %s", async locale => {
    const html = await renderPage(locale, true);
    for (const path of ["/#generator", "/#features", "/#how-it-works", "/#faq", "/hotel-lobby-ai-video-generator", "/showcases", "/showcases#video-examples", "/pricing", "/black-friday", "/blog", "/ai-rap-song-generator", "/hotel-lobby-ai-video-generator-free", "/hotel-lobby-ai-template", "/hotel-lobby-ai-filter", "/hotel-lobby-ai-generator", "/blog/best-hotel-lobby-ai-video-generators-2026"]) expect(html).toContain(`href="${localizeHref(path, locale)}"`);
    expect(html).not.toContain(`href="${localizeHref("/hotel-lobby-ai-video-generator#generator", locale)}"`);
    expect(html).toContain('mailto:cuilinhao2021@gmail.com');
  });
});

describe("independent Hotel Lobby guide", () => {
  it.each(locales)("keeps its original guide, generator, SEO and structured data in %s", async locale => {
    const html = await renderPage(locale);
    const messages = getMessages(locale);
    const text = (source: string) => renderToStaticMarkup(<>{(messages[source] ?? source).replaceAll("LobbyDuo", "MigosAI")}</>);
    expect(html).toContain(text("Hotel Lobby AI Video Generator"));
    expect(html).not.toContain('id="home-hero-title"');
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    for (const id of ["generator", "how-it-works", "faq", "showcase", "mi-left-photo", "mi-right-photo"]) expect(html.match(new RegExp(`id="${id}"`, "g"))).toHaveLength(1);
    for (const item of [...hotelLobbySteps, ...hotelLobbyFaqs]) for (const source of Object.values(item)) expect(html).toContain(text(source));
    expect(html).toContain(text("Photo requirements & best results"));
    expect(html).toContain(text("Hotel Lobby AI video generator vs. general-purpose AI video tools"));
    expect(html).toContain('"@type":"SoftwareApplication"');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('href="#generator"');
    expect(html).toContain(`href="${localizeHref("/hotel-lobby-ai-template", locale)}"`);
    const metadata = await generateMetadata();
    expect(metadata.alternates?.canonical).toBe(`https://migosai.design${localizeHref("/hotel-lobby-ai-video-generator", locale)}`);
  });
});
