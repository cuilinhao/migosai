import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOzilPrompt, defaultPromptSelection, normalizeOutfitDetail, promptOptions } from '../components/ozil-goal/prompt';
const originalDefault = readFileSync(new URL('./ozil-content-prompt-default.txt', import.meta.url), 'utf8');
describe('original public Ozil prompt builder', () => {
  it('matches the original SSR default prompt character for character', () => {
    expect(buildOzilPrompt(defaultPromptSelection)).toBe(originalDefault);
  });
  it('preserves all original options and defaults', () => {
    expect(Object.fromEntries(Object.entries(promptOptions).map(([key, values]) => [key, values.map(item => item.value)]))).toEqual({ length: ['5', '10', '15'], split: ['one', 'three'], outfit: ['photo', 'suit', 'casual', 'cosy'], setting: ['night', 'rain', 'day'], camera: ['broadcast', 'low', 'drone'], ending: ['run', 'goal', 'celebrate'] });
    expect(defaultPromptSelection).toEqual({ length: '10', outfit: 'photo', detail: '', setting: 'night', camera: 'broadcast', ending: 'goal', split: 'one' });
  });
  it.each([
    ['5', ['0 to 1s:', '1 to 3s:', '3 to 5s:'], ['1', '2', '2']],
    ['10', ['0 to 2s:', '2 to 5.5s:', '5.5 to 10s:'], ['2', '3.5', '4.5']],
    ['15', ['0 to 3s:', '3 to 8.5s:', '8.5 to 15s:'], ['3', '5.5', '6.5']],
  ] as const)('uses the original half-second rounding at %s seconds', (length, boundaries, durations) => {
    const one = buildOzilPrompt({ ...defaultPromptSelection, length });
    for (const boundary of boundaries) expect(one).toContain(boundary);
    const three = buildOzilPrompt({ ...defaultPromptSelection, length, split: 'three' }).split('\n\n');
    expect(three).toHaveLength(3);
    three.forEach((shot, index) => expect(shot.split('\n')[0]).toBe(`SHOT ${index + 1} of 3 - vertical 9:16 video, about ${durations[index]} seconds, one continuous shot.`));
  });
  it.each([
    ['outfit', 'suit', 'They wear a dark office suit, white shirt and smart shoes. Not a football kit.'],
    ['outfit', 'casual', 'They wear blue jeans, a plain grey hoodie and trainers. Not a football kit.'],
    ['outfit', 'cosy', 'They wear a fluffy dressing gown over pyjamas and slippers. Not a football kit.'],
    ['setting', 'rain', 'A large football stadium at night in steady rain, floodlights catching the raindrops, wet shiny turf, a packed crowd softly out of focus.'],
    ['setting', 'day', 'A large football stadium on a sunny afternoon, long shadows on the green turf, a packed crowd softly out of focus.'],
    ['camera', 'low', 'Camera: low tracking shot at pitch level, running alongside the main person, slight handheld movement, full body visible.'],
    ['camera', 'drone', 'Camera: high wide angle from above the stand, slowly following the play, the main person clearly visible in full.'],
    ['ending', 'run', 'the main person keeps the ball and runs on towards the empty goal.'],
    ['ending', 'celebrate', 'the main person slots the ball into the empty net, then turns to the camera with arms wide open, smiling.'],
  ] as const)('preserves source text for %s=%s', (key, value, expected) => {
    expect(buildOzilPrompt({ ...defaultPromptSelection, [key]: value })).toContain(expected);
  });
  it('normalizes detail in the original order, including removal before whitespace collapsing', () => {
    expect(normalizeOutfitDetail('  Café “red” scarf, ‘round’ glasses 🏆中文  ')).toBe('Cafe "red" scarf, \'round\' glasses');
    expect(normalizeOutfitDetail('red\nscarf\tblue')).toBe('redscarfblue');
    expect(normalizeOutfitDetail(' ' + 'é'.repeat(100) + ' ')).toBe('e'.repeat(90));
    expect(buildOzilPrompt({ ...defaultPromptSelection, detail: '  Café scarf  ' })).toContain('Extra outfit detail: Cafe scarf.');
    expect(buildOzilPrompt({ ...defaultPromptSelection, detail: '中文🏆' })).not.toContain('Extra outfit detail:');
  });
  it('builds every one of the 648 option combinations with complete, ordered beats', () => {
    let count = 0;
    for (const length of promptOptions.length) for (const split of promptOptions.split) for (const outfit of promptOptions.outfit) for (const setting of promptOptions.setting) for (const camera of promptOptions.camera) for (const ending of promptOptions.ending) {
      const prompt = buildOzilPrompt({ length: length.value, split: split.value, outfit: outfit.value, setting: setting.value, camera: camera.value, ending: ending.value, detail: 'Red scarf' });
      expect(prompt).not.toMatch(/undefined|[^\x09\x0a\x0d\x20-\x7e]/);
      expect(prompt.indexOf('a goalkeeper rushes out')).toBeLessThan(prompt.indexOf('the ball pops up'));
      expect(prompt.indexOf('the ball pops up')).toBeLessThan(prompt.indexOf('a defender slides in'));
      const copies = split.value === 'three' ? 3 : 1;
      expect(prompt.match(/Main person:/g)).toHaveLength(copies);
      expect(prompt.match(/Extra outfit detail: Red scarf\./g)).toHaveLength(copies);
      expect(prompt.match(/Sound:/g)).toHaveLength(copies);
      expect(prompt.match(/Avoid:/g)).toHaveLength(copies);
      count++;
    }
    expect(count).toBe(648);
  });
});
