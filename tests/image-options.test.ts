import { describe, expect, it } from 'vitest';
import { imageCreditCost } from '../lib/image';

describe('image credit quote', () => {
  it.each([['1K', 5], ['2K', 8], ['4K', 12]])('quotes %s at %s credits', (resolution, credits) => {
    expect(imageCreditCost(resolution as '1K')).toBe(credits);
  });
  it.each(['720p', '', '8K', null, 0])('rejects unsupported resolution %s', resolution => {
    expect(() => imageCreditCost(resolution as '1K')).toThrow();
  });
});
