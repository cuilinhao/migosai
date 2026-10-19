import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { GeneratorMenu, GeneratorSpotlight } from "../components/generator-menu";
import { getMessages } from "../lib/i18n";

const render = (node: React.ReactNode, locale: "en" | "ja" = "en") => renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}>{node}</LocaleProvider>);

describe("generator navigation", () => {
  it("leads with Flying Car and preserves the existing generator choices", () => {
    const html = render(<GeneratorMenu pathname="/"/>);
    expect(html.indexOf('href="/flying-car-ai-video-generator"')).toBeGreaterThan(-1);
    expect(html.indexOf('href="/flying-car-ai-video-generator"')).toBeLessThan(html.indexOf('href="/ozil-goal-generator"'));
    expect(html.indexOf('href="/ozil-goal-generator"')).toBeGreaterThan(-1);
    expect(html.indexOf('href="/ozil-goal-generator"')).toBeLessThan(html.indexOf('href="/ai-rap-song-generator"'));
    // The first slide is the one visible before the rotation starts.
    expect(html).toMatch(/generator-menu-slide is-shown"><svg[^]*?<span>Flying Car AI Generator<\/span><b class="generator-new-badge">NEW<\/b>/);
    expect(html).toContain('<span class="sr-only">Flying Car AI Generator / Ozil Goal Generator / AI Rap Song Generator</span>');
  });

  it("keeps the current generator selected while the desktop pill starts its rotation", () => {
    const html = render(<GeneratorMenu pathname="/ai-rap-song-generator"/>);
    expect(html).toContain("generator-menu-trigger active");
    expect(html.match(/generator-menu-slide is-shown"><svg[^]*?<\/svg><span>([^<]+)<\/span>/)?.[1]).toBe("Flying Car AI Generator");
    expect(html).toContain('<span class="sr-only">Flying Car AI Generator / Ozil Goal Generator / AI Rap Song Generator</span>');
    expect(html).toContain('aria-current="page" href="/ai-rap-song-generator"');
  });

  it("shows the newest generator shortcut outside its own pages", () => {
    expect(render(<GeneratorSpotlight pathname="/"/>)).toContain('class="generator-spotlight" href="/flying-car-ai-video-generator"');
    expect(render(<GeneratorSpotlight pathname="/ai-rap-song-generator"/>)).toContain('href="/flying-car-ai-video-generator"');
    expect(render(<GeneratorSpotlight pathname="/ozil-goal-generator"/>)).toContain('href="/flying-car-ai-video-generator"');
    expect(render(<GeneratorSpotlight pathname="/flying-car-ai-video-generator"/>)).toBe("");
    expect(render(<GeneratorSpotlight pathname="/flying-car-ai-video-generator/tesla-flying-car-ai-video-trend"/>)).toBe("");
  });

  it("localizes the generator cards and links", () => {
    const html = render(<GeneratorMenu pathname="/"/>, "ja");
    expect(html).toContain("写真1枚で話題のOzilゴール動画を作成");
    expect(html).toContain('href="/ja/ozil-goal-generator"');
  });
});
