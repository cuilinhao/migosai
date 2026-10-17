import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type SourceNode = string | { slot: string } | { tag: string; attrs: Record<string, string | null>; children: SourceNode[] };
const json = (file: string) => JSON.parse(readFileSync(resolve(file), 'utf8'));
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();
function text(node: SourceNode): string {
  return typeof node === 'string' ? node : 'children' in node ? node.children.map(text).join('') : '';
}

describe('FlyingCar source and media integrity', () => {
  it('keeps all thirteen mirrored files byte-for-byte identical to their recorded source downloads', () => {
    const assets = json('content/flyingcar-assets.json');
    const manifest = json('content/flyingcar-source-manifest.json');
    expect(assets).toHaveLength(13);
    expect(manifest.assets).toEqual(assets);
    const seen = new Set<string>();
    for (const asset of assets) {
      expect(asset.source).toMatch(/^https:\/\/(?:flyingcar-ai\.app|images\.chibistyle\.art)\//);
      expect(asset.path).toMatch(/^\/flyingcar\//);
      expect(seen.has(asset.path)).toBe(false);
      seen.add(asset.path);
      const bytes = readFileSync(resolve(`public${asset.path}`));
      expect(bytes.byteLength, asset.path).toBe(asset.bytes);
      expect(digest(bytes), asset.path).toBe(asset.sha256);
    }
    expect(assets.reduce((total: number, asset: { bytes: number }) => total + asset.bytes, 0)).toBe(9_232_130);
  });

  it('preserves every noncommercial source heading and prose unit recorded during the source import', () => {
    const manifest = json('content/flyingcar-source-manifest.json');
    const pages = json('content/flyingcar-pages.json');
    let checked = 0;
    for (const [slug, page] of Object.entries(manifest.pages) as [string, any][]) {
      if (!page.coverage) continue;
      const migrated = normalized(text(pages[slug].content));
      for (const unit of page.coverage.preservedUnits) {
        expect(digest(unit.text), `${slug}: source fixture checksum`).toBe(unit.sha256);
        expect(migrated, `${slug}: missing original ${unit.tag}`).toContain(unit.text);
        checked += 1;
      }
      for (const unit of page.coverage.adaptedOrSlottedUnits) expect(unit.reason.length).toBeGreaterThan(20);
    }
    expect(checked).toBeGreaterThanOrEqual(150);
  });

  it('retains legal source snapshots without presenting their old commercial terms as the migosai service', () => {
    const legal = json('content/flyingcar-source-legal.json');
    const manifest = json('content/flyingcar-source-manifest.json');
    const pages = json('content/flyingcar-pages.json');
    expect(Object.keys(legal).sort()).toEqual(['privacy', 'terms']);
    for (const slug of ['privacy', 'terms']) {
      const original = normalized(text(legal[slug].sourceContent));
      for (const heading of manifest.pages[slug].sourceHeadings) expect(original).toContain(normalized(heading));
      expect(legal[slug].displayPolicy).toContain('Evidence only');
      expect(pages[slug]).toBeUndefined();
    }
    expect(JSON.stringify(pages)).not.toMatch(/HEIC|emailed|private (?:result )?link|Stripe Checkout|no[- ]login|no account/i);
    expect(JSON.stringify(pages.footer)).toContain('/privacy-policy');
    expect(JSON.stringify(pages.footer)).toContain('/terms-of-service');
  });
});
