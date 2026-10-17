import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readImageDimensions, validateFlyingCarPhotoDimensions } from '../lib/flyingcar-photo';

describe('FlyingCar dimension-bearing image headers', () => {
  it.each([
    ['320x480.png', 'image/png'], ['320x480.jpg', 'image/jpeg'], ['320x480-progressive.jpg', 'image/jpeg'],
    ['320x480.webp', 'image/webp'], ['320x480-lossless.webp', 'image/webp'], ['320x480-alpha.webp', 'image/webp'],
  ])('reads encoded width and height from %s', (name, mime) => {
    const bytes = new Uint8Array(readFileSync(new URL(`./fixtures/flyingcar-images/${name}`, import.meta.url)));
    expect(readImageDimensions(bytes, mime)).toEqual({ width: 320, height: 480 });
  });
  it.each([
    [300, 301, false], [301, 300, false], [301, 301, true],
    [6000, 3000, false], [3000, 6000, false], [5999, 3000, true], [3000, 5999, true],
    [400, 1000, false], [1000, 400, false], [401, 1000, true], [1000, 401, true],
    [NaN, 1000, false], [1000, Infinity, false], [301.5, 301, false],
  ] as const)('validates %s×%s against open provider bounds: %s', (width, height, valid) => {
    expect(validateFlyingCarPhotoDimensions(width, height)).toBe(valid);
  });
});
