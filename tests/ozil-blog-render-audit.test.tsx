import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OzilBlogArticle, OzilBlogIndex } from "../components/ozil-goal/blog";
import { ozilBlogMetadata } from "../components/ozil-goal/blog-metadata";
import { ozilBlogPosts } from "../content/ozil-blog";
import { ozilBlogText } from "../components/ozil-goal/blog-ui";

function auditMarkup(html: string) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) expect(ids, `Missing anchor ${match[1]}`).toContain(match[1]);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).not.toContain("LobbyDuo");
  expect(html).not.toContain("migosai/MigosAI");
  expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/(?<![\w@./:-])migosai(?![\w./:@-])/);
  expect(html).not.toMatch(/<footer\b/);
}

describe("all native Ozil blog articles", () => {
  it("normalizes display copy while retaining URLs, email addresses and asset paths", () => {
    const addresses = "https://migosai.design support@migosai.design /migosai/example.png migosai-widget";
    expect(ozilBlogText(`migosai credits. ${addresses}`)).toBe(`MigosAI credits. ${addresses}`);
  });
  it("keeps the full native-language catalog and valid language-section anchors", () => {
    const html = renderToStaticMarkup(<OzilBlogIndex/>);
    auditMarkup(html);
    for (const post of ozilBlogPosts) expect(html).toContain(`href="${post.path}"`);
  });

  it.each(ozilBlogPosts.map(post => [post.path, post] as const))("renders complete content, current branding and valid anchors at %s", (_, post) => {
    const html = renderToStaticMarkup(<OzilBlogArticle post={post}/>);
    auditMarkup(html);
    for (const section of post.sections) expect(html).toContain(`id="${section.id}"`);
    expect(html).toContain('id="faq"');
    expect(html).toContain('id="sources"');
    expect(html).toContain('href="/ozil-goal-generator#generator"');
    const metadata = ozilBlogMetadata(post);
    expect(metadata.alternates?.canonical).toBe(`https://migosai.design${post.path}`);
    expect(metadata.openGraph?.siteName).toBe("MigosAI");
    expect(metadata.description).not.toMatch(/(?<![\w@./:-])migosai(?![\w./:@-])/);
  });
});
