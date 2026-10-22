import { describe, expect, it } from 'vitest';
import { videoEffects } from '@/content/effects';
import { effectTemplates, getEffectCreationHref, getEffectTemplate } from '@/content/effect-templates';

describe('effect creation destinations', () => {
  it('gives every catalogue effect its own valid, editable template', () => {
    expect(effectTemplates).toHaveLength(77);
    expect(effectTemplates.map(item => item.effect.id)).toEqual(videoEffects.map(item => item.id));
    expect(new Set(effectTemplates.map(item => item.prompt)).size).toBe(77);
    for (const { effect, prompt } of effectTemplates) {
      expect(prompt.length).toBeGreaterThanOrEqual(40);
      expect(prompt.length).toBeLessThanOrEqual(600);
      expect(prompt).not.toContain('undefined');
      expect(getEffectTemplate(effect.id)).toEqual({ effect, prompt });
      expect(getEffectCreationHref(effect)).toMatch(/^\/(?!\/)/);
      expect(getEffectCreationHref(effect)).not.toBe('/ai-video-generator');
    }
  });

  it('uses the three existing dedicated workflows and their generator anchors', () => {
    expect(getEffectCreationHref(videoEffects[0])).toBe('/hotel-lobby-ai-video-generator#generator');
    expect(getEffectCreationHref(videoEffects[1])).toBe('/flying-car-ai-video-generator#create');
    expect(getEffectCreationHref(videoEffects[4])).toBe('/ozil-goal-generator#generator');
  });

  it('uses a distinct internal effect page for every remaining effect', () => {
    const remaining = videoEffects.filter((_, index) => ![0, 1, 4].includes(index));
    expect(remaining).toHaveLength(74);
    expect(new Set(remaining.map(getEffectCreationHref)).size).toBe(74);
    for (const effect of remaining) expect(getEffectCreationHref(effect)).toBe(`/effects/${effect.id}`);
  });

  it('does not return a template for unknown IDs or object prototype names', () => {
    for (const id of ['', 'missing', 'constructor', '__proto__', '../ai-video-generator']) {
      expect(getEffectTemplate(id)).toBeUndefined();
    }
  });

  it('keeps child dance prompts age appropriate and the adult dance separate', () => {
    const childIds = [63, 64, 65, 66, 67, 69, 70, 71, 72, 73, 74, 75];
    for (const index of childIds) {
      const template = effectTemplates[index - 1];
      expect(template.prompt).toContain('age-appropriate');
      expect(template.prompt.toLowerCase()).not.toMatch(/twerk|seduct|sensual|sexy/);
    }
    expect(effectTemplates[54].prompt).toContain('adult');
  });
});
