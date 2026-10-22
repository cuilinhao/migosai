import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../components/auth-provider';
import { OzilGoalPage } from '../components/ozil-goal/page-content';
import pages from '../content/ozil-goal-pages.json';

// Server rendering needs a request locale; the page and all its UI stay real.
const request = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-migos-locale': request.locale }) }));

async function render(slug: Parameters<typeof OzilGoalPage>[0]['slug'] = 'home') {
  return renderToStaticMarkup(createElement(AuthProvider, null, await OzilGoalPage({ slug })));
}

function visibleText(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

function schemaFrom(html: string) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  expect(scripts).toHaveLength(1);
  return JSON.parse(scripts[0][1]);
}

describe('Ozil landing page structured data', () => {
  it('publishes the same twelve FAQ answers and three instructions that visitors can read', async () => {
    const html = await render();
    const data = schemaFrom(html);
    expect(data['@context']).toBe('https://schema.org');
    const faq = data['@graph'].find((entry: { '@type': string }) => entry['@type'] === 'FAQPage');
    const howTo = data['@graph'].find((entry: { '@type': string }) => entry['@type'] === 'HowTo');
    const visibleFaqs = [...html.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].map(([, detail]) => ({
      name: visibleText(detail.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)![1]),
      answer: visibleText(detail.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)![1]),
    }));
    expect(visibleFaqs).toHaveLength(12);
    expect(faq.mainEntity).toEqual(visibleFaqs.map(({ name, answer }) => ({
      '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text: answer },
    })));
    const instructions = html.match(/<ol\b[^>]*>([\s\S]*?)<\/ol>/)![1];
    const visibleSteps = [...instructions.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, step], index) => ({
      '@type': 'HowToStep', position: index + 1,
      name: visibleText(step.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)![1]),
      text: visibleText(step.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)![1]),
    }));
    expect(visibleSteps.map(step => step.name)).toEqual(['Add one photo', 'Press Make my video', 'Download and post']);
    expect(howTo.step).toEqual(visibleSteps);
    expect(faq.url).toBe('https://migosai.design/ozil-goal-generator');
    expect(howTo.url).toBe(faq.url);
    expect(faq.publisher.name).toBe('LobbyDuo');
    expect(howTo.publisher.name).toBe('LobbyDuo');
    expect(JSON.stringify(data)).not.toContain('{{OZIL_GOAL_COST}}');
    expect(JSON.stringify(faq)).toContain('300 credits');
  });

  it('uses the locale route as its canonical while describing the visible English content', async () => {
    request.locale = 'es';
    try {
      const data = schemaFrom(await render());
      for (const entry of data['@graph']) {
        expect(entry.url).toBe('https://migosai.design/es/ozil-goal-generator');
        expect(entry['@id']).toMatch(/^https:\/\/migosai\.design\/es\/ozil-goal-generator#/);
        expect(entry.inLanguage).toBe('en');
      }
    } finally { request.locale = 'en'; }
  });

  it('keeps guide content and independent-tool disclosure without adding page-level chrome', async () => {
    const html = await render('ozil-goal-trend');
    expect(html).not.toContain('application/ld+json');
    expect(html).not.toMatch(/<footer\b/);
    expect(visibleText(html)).toContain('Ozil goal trend');
    expect(visibleText(html)).toContain('Not affiliated with any footballer, club, league, federation or broadcaster.');
  });

  it('keeps text containing a script end tag inside JSON-LD', async () => {
    type Node = string | { tag?: string; children?: Node[] };
    function find(node: Node, tag: string): Exclude<Node, string> | undefined {
      if (typeof node === 'string') return;
      if (node.tag === tag) return node;
      for (const child of node.children ?? []) { const found = find(child, tag); if (found) return found; }
    }
    const answer = find(find(pages.home.content as Node, 'details')!, 'p')!;
    const original = answer.children;
    const hostileText = 'Text with </script><script>alert("x")</script> & a photo.';
    answer.children = [hostileText];
    try {
      const html = await render();
      const data = schemaFrom(html);
      expect(html).not.toContain('<script>alert("x")</script>');
      expect(data['@graph'].find((entry: { '@type': string }) => entry['@type'] === 'FAQPage').mainEntity[0].acceptedAnswer.text).toBe(hostileText);
    } finally { answer.children = original; }
  });
});
