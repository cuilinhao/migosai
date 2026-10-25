import { describe, expect, it } from 'vitest';
import { blackFridayCopy } from '../content/black-friday-copy';
import { getMessages } from '../lib/i18n';
import { locales } from '../lib/i18n/routing';

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}
const sourceStrings = [...new Set([...strings(blackFridayCopy),
  'Black Friday 2026', 'More credits for your next idea.', 'See the offer, dates and eligible credit packs.',
  'Explore Black Friday', '{percent}% bonus credits', '{base} + {bonus} bonus credits',
  'This credit pack offer has changed. Refresh pricing before you check out.',
])];

describe('Black Friday translations', () => {
  it.each(locales.filter(locale => locale !== 'en'))('translates the full offer and preserves every interpolation in %s', locale => {
    const messages = getMessages(locale);
    for (const source of sourceStrings) {
      expect(messages[source], `${locale}: ${source}`).toBeTypeOf('string');
      expect(messages[source].trim(), `${locale}: ${source}`).not.toBe('');
      expect((messages[source].match(/\{\w+\}/g) ?? []).sort(), source).toEqual((source.match(/\{\w+\}/g) ?? []).sort());
    }
  });
});
