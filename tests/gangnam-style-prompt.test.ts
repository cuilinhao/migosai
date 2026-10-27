import { describe, expect, it } from 'vitest';
import { gangnamStylePrompt } from '../lib/prompts/gangnam-style';

describe('Gangnam Style selfie relay direction', () => {
  it.each(['friends', 'selfie', 'pets'] as const)('uses the actual reference camera and solo sequence for %s', mode => {
    const prompt = gangnamStylePrompt(mode);
    expect(prompt).toContain('@Video1');
    expect(prompt).toMatch(/handheld.*selfie/i);
    expect(prompt).toContain('0–2');
    expect(prompt).toContain('4.9–8.4');
    expect(prompt).toContain('8.4–12.3');
    expect(prompt).not.toMatch(/stable frontal wide shot|head to foot throughout|perform the playful horse-riding dance/i);
  });

  it('assigns uploaded people to the existing middle, right, left slots', () => {
    const prompt = gangnamStylePrompt('friends');
    expect(prompt).toMatch(/@Image1[^.]*middle/);
    expect(prompt).toMatch(/@Image2[^.]*right/);
    expect(prompt).toMatch(/@Image3[^.]*left/);
    expect(prompt).toMatch(/every.*solo.*close-up/i);
  });

  it('keeps one selfie as all three identities without referencing missing uploads', () => {
    const prompt = gangnamStylePrompt('selfie');
    expect(prompt).toContain('@Image1');
    expect(prompt).not.toMatch(/@Image[23]/);
    expect(prompt).toMatch(/three.*copies/i);
  });
});
