import { describe, expect, it } from 'vitest';
import { gangnamStylePrompt } from '../lib/prompts/gangnam-style';

describe('Gangnam Style reference identities', () => {
  it.each(['friends', 'pets'] as const)('uses all three uploaded identities and one video for %s', mode => {
    const prompt = gangnamStylePrompt(mode);
    expect([...new Set(prompt.match(/@Image\d+/g))].sort()).toEqual(['@Image1', '@Image2', '@Image3']);
    expect([...new Set(prompt.match(/@Video\d+/g))]).toEqual(['@Video1']);
  });

  it('does not reference nonexistent second or third uploads in selfie mode', () => {
    const prompt = gangnamStylePrompt('selfie');
    expect([...new Set(prompt.match(/@Image\d+/g))]).toEqual(['@Image1']);
    expect(prompt).toMatch(/three separate copies of the same adult/);
  });

  it('uses animal appearance and anatomy for pets', () => {
    expect(gangnamStylePrompt('pets')).toMatch(/species.*fur.*front-paw.*animal anatomy/);
  });
});
