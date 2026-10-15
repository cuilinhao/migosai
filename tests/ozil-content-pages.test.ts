import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import pages from '../content/ozil-goal-pages.json';
import manifest from '../content/ozil-goal-source-manifest.json';
import interactions from '../content/ozil-goal-interactions.json';
type Node = string | { slot: string } | { tag: string; attrs: Record<string, string | null>; children: Node[] };
function walk(node: Node): Node[] { return [node, ...(typeof node !== 'string' && 'children' in node ? node.children.flatMap(walk) : [])]; }
const slugs = Object.keys(manifest) as (keyof typeof manifest)[];
const text = (node: Node): string => typeof node === 'string' ? node : 'children' in node ? node.children.map(text).join('') : '';
describe('Ozil public content migration', () => {
  it.each(slugs)('preserves all FAQs and non-commercial headings in %s', slug => {
    const nodes = walk(pages[slug].content as Node);
    const details = nodes.filter(node => typeof node !== 'string' && 'tag' in node && node.tag === 'details');
    expect(details).toHaveLength(manifest[slug].sourceFaqCount);
    const headings = nodes.filter(node => typeof node !== 'string' && 'tag' in node && /^h[1-3]$/.test(node.tag)).map(text);
    const slotHeadings = ['One video, three, or seven', '1 Video', '3 Videos', '7 Videos', 'Start ticking', 'The flying keeper'];
    for (const heading of manifest[slug].sourceHeadings) if (!slotHeadings.includes(heading)) expect(headings).toContain(heading);
    const path = slug === 'home' ? 'app/ozil-goal-generator/page.tsx' : `app/ozil-goal-generator/${slug}/page.tsx`;
    expect(readFileSync(resolve(path), 'utf8')).toContain('generateMetadata');
  });
  it('contains no source scripts, tracking attributes, remote media or old account links', () => {
    for (const node of [...slugs.flatMap(slug => walk(pages[slug].content as Node)), ...walk(pages.footer as Node)]) {
      if (typeof node === 'string' || !('tag' in node)) continue;
      if (node.tag === 'button') expect(node.attrs['data-og-seek']).toMatch(/^[0-2]$/);
      expect(['script', 'iframe', 'object', 'embed', 'style']).not.toContain(node.tag);
      for (const [key, value] of Object.entries(node.attrs)) {
        expect(key).not.toMatch(/^on|^data-track|^data-base/);
        if (key === 'src' || key === 'poster') { expect(value).toMatch(/^\/ozil-goal\//); expect(existsSync(resolve('public' + value))).toBe(true); }
        if (key === 'href') expect(value).not.toMatch(/ozilgoal\.com|^\/auth\/|^\/my-videos|llms/);
      }
    }
  });
  it('removes original pricing, fixed retention and source-generation attribution claims', () => {
    const all = JSON.stringify(pages);
    expect(all).not.toMatch(/\$\d|5 to 8 minutes|deleted when the render ends|Your photo is not kept|video kept 30 days|videos kept 1 year|never expire|Made with this generator|Made here from/i);
    expect(all).toContain('{{OZIL_GOAL_COST}}');
    expect(all).toContain('migosai Privacy Policy');
  });
  it('restores all interactive tool slots and complete caption/checklist data', () => {
    const slots = slugs.flatMap(slug => walk(pages[slug].content as Node)).filter((node): node is {slot: string} => typeof node !== 'string' && 'slot' in node).map(node => node.slot);
    expect(slots).toEqual(expect.arrayContaining(['generator', 'sample', 'credits', 'prompt', 'template-check', 'photo-check', 'timeline', 'captions', 'route-chooser']));
    expect(interactions.captions).toHaveLength(25); expect(interactions.captionMoods).toHaveLength(6); expect(interactions.templateChecks).toHaveLength(6); expect(interactions.photoChecks).toHaveLength(7);
    expect(interactions.photoChecks.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
  });
  it('scopes every reference selector, registered property and animation', () => {
    const stylesheet = postcss.parse(readFileSync(resolve('components/ozil-goal/reference.css'), 'utf8'));
    stylesheet.walkRules(rule => { if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return; for (const selector of rule.selectors) expect(selector.startsWith('.ozil-page')).toBe(true); });
    stylesheet.walkAtRules('property', rule => expect(rule.params).toMatch(/^--og/));
    stylesheet.walkAtRules('keyframes', rule => expect(rule.params).toMatch(/^ozil-ref-/));
  });
});
