import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../components/auth-provider";
import { FlyingCarPage, type FlyingCarPageSlug } from "../components/flyingcar/page-content";
import { OzilGoalPage, ozilMetadata, type OzilPageSlug } from "../components/ozil-goal/page-content";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-migos-locale": "en" }) }));

describe("tool pages inside the shared portal shell", () => {
  it.each([
    ["home", "Create Your Own Tesla Roadster Flying Car Video"],
    ["how-to-make-a-tesla-roadster-flying-car-video", "How to make a Tesla Roadster flying car video with AI"],
    ["tesla-flying-car-ai-video-trend", "Tesla flying car AI video trend: Roadster memes explained"],
  ] as [FlyingCarPageSlug, string][])("keeps Flying Car %s content and disclosure with no duplicate header or footer", async (slug, title) => {
    const page = await FlyingCarPage({ slug });
    const html = renderToStaticMarkup(<AuthProvider>{page}</AuthProvider>);
    expect(html).not.toMatch(/<footer\b|class="fc-site-header"/);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.replace(/<[^>]*>/g, "")).toContain(title);
    expect(html).toContain("Tesla, Inc. or any vehicle manufacturer.");
    expect(html).toContain("All videos are AI-generated; results vary and should be reviewed before publishing.");
    expect(html).not.toContain("LobbyDuo");
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/(?<![\w@./:-])migosai(?![\w./:@-])/);
  });

  it.each([
    ["home", "Ozil AI Goal Video Maker"],
    ["ozil-goal-ai-prompt", "Ozil goal AI prompt"],
    ["ozil-goal-ai-template", "Ozil goal AI template"],
    ["ozil-goal-trend", "Ozil goal trend"],
    ["ozil-goal-meme", "Ozil goal meme"],
    ["ozil-goal-capcut-template", "Ozil goal CapCut template vs AI"],
    ["ai-football-video-from-photo", "AI football video from a photo"],
  ] as [OzilPageSlug, string][])("keeps Ozil %s content, disclosure and sticky generator control with no duplicate footer", async (slug, title) => {
    const page = await OzilGoalPage({ slug });
    const html = renderToStaticMarkup(<AuthProvider>{page}</AuthProvider>);
    expect(html).not.toMatch(/<footer\b/);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.replace(/<[^>]*>/g, "")).toContain(title);
    expect(html).toContain("Not affiliated with any footballer, club, league, federation or broadcaster.");
    expect(html).toContain("Videos are AI-generated and may use a consenting adult");
    expect(html).toContain("og-sticky fixed");
    expect(html).toContain('href="/ozil-goal-generator#generator"');
    expect(html).not.toContain("LobbyDuo");
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/(?<![\w@./:-])migosai(?![\w./:@-])/);
    expect(ozilMetadata(slug).description).not.toMatch(/(?<![\w@./:-])migosai(?![\w./:@-])/);
  });
});
