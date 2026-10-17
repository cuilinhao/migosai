import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

type SourceNode = string | { slot: string } | { tag: string; attrs: Record<string, string | null>; children: SourceNode[] };
function walk(node: SourceNode): SourceNode[] {
  return [node, ...(typeof node === 'object' && 'children' in node ? node.children.flatMap(walk) : [])];
}
const slugs = ['home', 'how-to-make-a-tesla-roadster-flying-car-video', 'tesla-flying-car-ai-video-trend'];

describe('FlyingCar public content migration', () => {
  it('ships every public content page and all seventeen landing-page FAQ answers', () => {
    const path = resolve('content/flyingcar-pages.json');
    expect(existsSync(path)).toBe(true);
    const pages = JSON.parse(readFileSync(path, 'utf8'));
    for (const slug of slugs) {
      expect(pages[slug].title.length).toBeGreaterThan(15);
      expect(pages[slug].description.length).toBeGreaterThan(30);
      const nodes = walk(pages[slug].content);
      const headings = nodes.filter(node => typeof node === 'object' && 'tag' in node && node.tag === 'h1');
      expect(headings).toHaveLength(1);
    }
    const faqs = walk(pages.home.content).filter(node => typeof node === 'object' && 'tag' in node && node.tag === 'details');
    expect(faqs).toHaveLength(17);
    for (const faq of faqs) expect(JSON.stringify(faq).length).toBeGreaterThan(160);
  });

  it('keeps all media local, removes original checkout promises, and has no executable source nodes', () => {
    const path = resolve('content/flyingcar-pages.json');
    expect(existsSync(path)).toBe(true);
    const pages = JSON.parse(readFileSync(path, 'utf8'));
    const nodes = [...slugs.flatMap(slug => walk(pages[slug].content)), ...walk(pages.header), ...walk(pages.footer)];
    for (const node of nodes) {
      if (typeof node === 'string' || !('tag' in node)) continue;
      expect(['script', 'iframe', 'object', 'embed', 'style']).not.toContain(node.tag);
      for (const [name, value] of Object.entries(node.attrs)) {
        expect(name).not.toMatch(/^on|^data-track/i);
        if (name === 'src' || name === 'poster') {
          expect(value).toMatch(/^\/flyingcar\//);
          expect(existsSync(resolve(`public${value}`))).toBe(true);
        }
        if (name === 'href') expect(value).not.toMatch(/flyingcar-ai\.app|^\/wait\/|^\/result\/|unforgettablecarai/);
      }
    }
    expect(JSON.stringify(pages)).not.toMatch(/\$4\.99|\$9\.99|\$29\.99|No login required|no account|Stripe Checkout collects|Private link \+ email/i);
    for (const slug of ['overpass-launch', 'thruster-hover', 'downtown-flyby', 'highway-leap']) {
      for (const ext of ['jpg', 'mp4']) expect(existsSync(resolve(`public/flyingcar/real/${slug}.${ext}`))).toBe(true);
    }
  });

  it('isolates source styles from the rest of migosai', () => {
    const path = resolve('components/flyingcar/reference.css');
    expect(existsSync(path)).toBe(true);
    const css = postcss.parse(readFileSync(path, 'utf8'));
    css.walkRules(rule => {
      if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
      for (const selector of rule.selectors) expect(selector.startsWith('.flyingcar-page')).toBe(true);
    });
    css.walkAtRules('keyframes', rule => expect(rule.params).toMatch(/^flyingcar-/));
    css.walkAtRules('property', rule => expect(rule.params).toMatch(/^--fc/));
  });
});
