import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sitemap from '../app/sitemap';
import { locales, localizeHref } from '../lib/i18n/routing';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Gangnam Style inner page', () => {
  it('publishes the new page in every existing UI locale with reciprocal alternates', () => {
    const entries = sitemap();
    for (const locale of locales) {
      const url = `https://migosai.design${localizeHref('/gangnam-style-ai-video-generator', locale)}`;
      const entry = entries.find(item => item.url === url);
      expect(entry, url).toBeDefined();
      expect(entry?.lastModified).toBe('2026-10-27');
      expect(Object.keys(entry?.alternates?.languages ?? {})).toHaveLength(7);
    }
  });
  it('keeps every homepage section and all eleven FAQs in its imported content', () => {
    expect(existsSync(path.join(root, 'content/gangnam-style-page.json'))).toBe(true);
    const content = read('content/gangnam-style-page.json');
    for (const text of ['Gangnam Style AI', 'Video Generator', 'Gangnam Style AI video examples', 'Pick what you want to make', 'Tips for a better clip', 'How to make your Gangnam Style AI video', 'Gangnam Style trio', 'Gangnam Style AI FAQ', 'FIELD NOTES']) expect(content).toContain(text);
    const tree = JSON.parse(content).content;
    const elements = (node: any): any[] => typeof node === 'string' ? [] : [node, ...(node.children ?? []).flatMap(elements)];
    expect(elements(tree).filter(node => node.tag === 'details')).toHaveLength(11);
    expect(elements(tree).filter(node => node.tag === 'script' || node.tag === 'iframe')).toHaveLength(0);
    expect(elements(tree).filter(node => node.slot === 'generator')).toHaveLength(1);
  });
  it('self hosts every original homepage media asset', () => {
    const manifest = JSON.parse(read('content/gangnam-style-assets.json'));
    const assets = Array.isArray(manifest) ? manifest : manifest.assets;
    expect(assets.filter((asset: any) => (asset.path ?? asset.localPath ?? '').endsWith('.mp4'))).toHaveLength(3);
    for (const asset of assets) expect(existsSync(path.join(root, 'public', asset.path ?? asset.localPath)), asset.path ?? asset.localPath).toBe(true);
  });
});
