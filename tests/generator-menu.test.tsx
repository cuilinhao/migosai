import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { GeneratorMenu, GeneratorSpotlight } from "../components/generator-menu";
import { getMessages } from "../lib/i18n";

const render = (node: React.ReactNode, locale: "en" | "ja" = "en") => renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}>{node}</LocaleProvider>);

describe("generator navigation", () => {
  it("leads with the Ozil Goal Generator on pages outside the generators", () => {
    const html = render(<GeneratorMenu pathname="/"/>);
    expect(html.indexOf('href="/ozil-goal-generator"')).toBeGreaterThan(-1);
    expect(html.indexOf('href="/ozil-goal-generator"')).toBeLessThan(html.indexOf('href="/ai-rap-song-generator"'));
    // The first slide is the one visible before the rotation starts.
    expect(html).toMatch(/generator-menu-slide is-shown"><svg[^]*?<span>Ozil Goal Generator<\/span><b class="generator-new-badge">NEW<\/b>/);
    expect(html).toContain('<span class="sr-only">Ozil Goal Generator / AI Rap Song Generator</span>');
  });

  it("names the current generator on its own pages", () => {
    const html = render(<GeneratorMenu pathname="/ai-rap-song-generator"/>);
    expect(html).toContain("generator-menu-trigger active");
    expect(html).toMatch(/generator-menu-slide is-shown"><svg[^]*?<span>AI Rap Song Generator<\/span>/);
    expect(html).toContain('aria-current="page" href="/ai-rap-song-generator"');
  });

  it("shows the header shortcut everywhere except the Ozil pages", () => {
    expect(render(<GeneratorSpotlight pathname="/"/>)).toContain('class="generator-spotlight" href="/ozil-goal-generator"');
    expect(render(<GeneratorSpotlight pathname="/ai-rap-song-generator"/>)).toContain('href="/ozil-goal-generator"');
    expect(render(<GeneratorSpotlight pathname="/ozil-goal-generator"/>)).toBe("");
    expect(render(<GeneratorSpotlight pathname="/ozil-goal-generator/blog/what-is-ozil-goal"/>)).toBe("");
  });

  it("localizes the generator cards and links", () => {
    const html = render(<GeneratorMenu pathname="/"/>, "ja");
    expect(html).toContain("写真1枚で話題のOzilゴール動画を作成");
    expect(html).toContain('href="/ja/ozil-goal-generator"');
  });
});
