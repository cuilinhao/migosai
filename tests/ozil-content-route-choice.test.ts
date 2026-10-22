import { describe, expect, it } from 'vitest';
import { getRouteRecommendation, routeQuestions } from '../components/ozil-goal/route-choice';
describe('original CapCut route chooser decision tree', () => {
  it('requires all four answers', () => { expect(routeQuestions).toHaveLength(4); expect(getRouteRecommendation({}, 123)).toBeNull(); expect(getRouteRecommendation({ app: 'a', opens: 'a', budget: 'b' }, 123)).toBeNull(); });
  it('preserves all 16 original decision outcomes', () => {
    const expected = ['capcut','capcut','both','site','capcut','capcut','site','site','capcut','capcut','site','site','capcut','capcut','site','site'];
    let index = 0;
    for (const app of ['a','b'] as const) for (const opens of ['a','b'] as const) for (const budget of ['a','b'] as const) for (const effort of ['a','b'] as const) {
      const result = getRouteRecommendation({ app, opens, budget, effort }, 123);
      expect(result?.cta).toBe(expected[index++]);
      expect(result?.text).not.toMatch(/\$|5 to 8|pack/);
      if (result?.cta === 'site') expect(result.text).toContain('123 shared MigosAI credits');
    }
    expect(index).toBe(16);
  });
});
