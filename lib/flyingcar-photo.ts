export type ImageDimensions = { width: number; height: number };

// Kie's reference-image documentation uses open intervals, not inclusive bounds.
export function validateFlyingCarPhotoDimensions(width: number, height: number): boolean {
  return Number.isInteger(width) && Number.isInteger(height)
    && width > 300 && width < 6000 && height > 300 && height < 6000
    && width * 5 > height * 2 && width * 2 < height * 5;
}

const word = (bytes: Uint8Array, offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
const be16 = (bytes: Uint8Array, offset: number) => bytes[offset] * 256 + bytes[offset + 1];
const be32 = (bytes: Uint8Array, offset: number) => bytes[offset] * 16777216 + bytes[offset + 1] * 65536 + bytes[offset + 2] * 256 + bytes[offset + 3];
const le24 = (bytes: Uint8Array, offset: number) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
const le32 = (bytes: Uint8Array, offset: number) => le24(bytes, offset) + bytes[offset + 3] * 16777216;
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 45 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    || be32(bytes, 8) !== 13 || word(bytes, 12) !== 'IHDR' || crc32(bytes.subarray(12, 29)) !== be32(bytes, 29)) return null;
  const width = be32(bytes, 16), height = be32(bytes, 20), depth = bytes[24], color = bytes[25];
  const depths: Record<number, readonly number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (!width || !height || width > 0x7fffffff || height > 0x7fffffff || !depths[color]?.includes(depth)
    || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) return null;
  let offset = 33, data = false;
  while (offset + 12 <= bytes.length) {
    const length = be32(bytes, offset), type = word(bytes, offset + 4), end = offset + length + 12;
    if (end > bytes.length || type === 'IHDR') return null;
    if (type === 'IDAT' && length > 0) data = true;
    if (type === 'IEND') return length === 0 && end === bytes.length && data ? { width, height } : null;
    offset = end;
  }
  return null;
}

const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8
    || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return null;
  let offset = 2, dimensions: ImageDimensions | null = null;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0x01) continue;
    if (marker === 0x00 || marker === 0xd8 || marker === 0xd9 || marker >= 0xd0 && marker <= 0xd7 || offset + 2 > bytes.length) return null;
    const length = be16(bytes, offset), end = offset + length;
    if (length < 2 || end > bytes.length) return null;
    if (frameMarkers.has(marker)) {
      if (length < 11 || dimensions) return null;
      const height = be16(bytes, offset + 3), width = be16(bytes, offset + 5), components = bytes[offset + 7];
      if (!width || !height || components < 1 || components > 4 || length !== 8 + 3 * components) return null;
      dimensions = { width, height };
    }
    if (marker === 0xda) return dimensions && length >= 6 && end < bytes.length - 2 ? dimensions : null;
    offset = end;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 26 || word(bytes, 0) !== 'RIFF' || word(bytes, 8) !== 'WEBP' || le32(bytes, 4) + 8 !== bytes.length) return null;
  let offset = 12, canvas: ImageDimensions | null = null, dimensions: ImageDimensions | null = null;
  while (offset + 8 <= bytes.length) {
    const type = word(bytes, offset), length = le32(bytes, offset + 4), start = offset + 8, end = start + length;
    const paddedEnd = end + (length % 2);
    if (end > bytes.length || paddedEnd > bytes.length) return null;
    if (type === 'VP8X') {
      if (offset !== 12 || length !== 10 || bytes[start] & 0xc3 || bytes[start + 1] || bytes[start + 2] || bytes[start + 3]) return null;
      canvas = { width: le24(bytes, start + 4) + 1, height: le24(bytes, start + 7) + 1 };
    } else if (type === 'VP8 ') {
      if (dimensions || length <= 10 || bytes[start] & 1 || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) return null;
      dimensions = { width: (bytes[start + 6] + bytes[start + 7] * 256) & 0x3fff, height: (bytes[start + 8] + bytes[start + 9] * 256) & 0x3fff };
    } else if (type === 'VP8L') {
      if (dimensions || length <= 5 || bytes[start] !== 0x2f || bytes[start + 4] & 0xe0) return null;
      const bits = le32(bytes, start + 1);
      dimensions = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    } else if (type === 'ANIM' || type === 'ANMF') return null;
    offset = paddedEnd;
  }
  if (offset !== bytes.length || !dimensions?.width || !dimensions.height
    || canvas && (canvas.width !== dimensions.width || canvas.height !== dimensions.height)) return null;
  return dimensions;
}

/** Reads bounded image containers without decoding pixels or loading native code.
 * This validates dimension-bearing headers, not every compressed image pixel. */
export function readImageDimensions(bytes: Uint8Array, mime: string): ImageDimensions | null {
  if (mime === 'image/png') return pngDimensions(bytes);
  if (mime === 'image/jpeg') return jpegDimensions(bytes);
  if (mime === 'image/webp') return webpDimensions(bytes);
  return null;
}
