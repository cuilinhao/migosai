import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareFlyingCarPhoto } from '@/components/flyingcar/photo-submission';

const photo = (size = 1024) => new File([new Uint8Array(size)], 'car.jpg', { type: 'image/jpeg' });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function decodedPhoto(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close })));
  return close;
}

describe('FlyingCar prepared photo dimensions', () => {
  it.each([[300, 600], [600, 300], [6000, 3000], [3000, 6000], [299, 600], [6001, 3000]])(
    'rejects an actual upload with a dimension outside the open interval: %s × %s', async (width, height) => {
      const close = decodedPhoto(width, height);
      await expect(prepareFlyingCarPhoto(photo(), () => {})).rejects.toThrow(/301.*5999|300.*6000/);
      expect(close).toHaveBeenCalledOnce();
    },
  );
  it.each([[400, 1000], [1000, 400], [400, 1001], [1001, 400]])(
    'rejects boundary or excessive aspect ratio: %s × %s', async (width, height) => {
      const close = decodedPhoto(width, height);
      await expect(prepareFlyingCarPhoto(photo(), () => {})).rejects.toThrow(/0\.4.*2\.5/);
      expect(close).toHaveBeenCalledOnce();
    },
  );
  it.each([[301, 301], [5999, 5999], [401, 1000], [1000, 401], [2048, 1152]])(
    'allows a decodable upload inside every dimension and ratio boundary: %s × %s', async (width, height) => {
      const close = decodedPhoto(width, height);
      const file = photo();
      expect(await prepareFlyingCarPhoto(file, () => {})).toBe(file);
      expect(close).toHaveBeenCalledOnce();
    },
  );
  it('checks the compressed output so a source above 6000 pixels may still upload', async () => {
    const original = photo(1024 * 1024 + 1);
    const originalClose = vi.fn();
    const preparedClose = vi.fn();
    const canvas = {
      width: 0, height: 0, getContext: () => ({ drawImage: () => {} }),
      toBlob: (callback: BlobCallback, type: string) => callback(new Blob([new Uint8Array(100_000)], { type })),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    const decode = vi.fn(async (file: File) => file === original
      ? { width: 8000, height: 6000, close: originalClose }
      : { width: 2048, height: 1536, close: preparedClose });
    vi.stubGlobal('createImageBitmap', decode);
    const prepared = await prepareFlyingCarPhoto(original, () => {});
    expect(prepared).not.toBe(original);
    expect(prepared.size).toBe(100_000);
    expect(decode).toHaveBeenLastCalledWith(prepared);
    expect([canvas.width, canvas.height]).toEqual([2048, 1536]);
    expect(originalClose).toHaveBeenCalledOnce();
    expect(preparedClose).toHaveBeenCalledOnce();
  });
  it('rejects a compressed output whose short edge is too small', async () => {
    const original = photo(1024 * 1024 + 1);
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (callback: BlobCallback, type: string) => callback(new Blob([new Uint8Array(100_000)], { type })),
    }) });
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async (file: File) => file === original
      ? { width: 8000, height: 1000, close }
      : { width: 2048, height: 256, close }));
    await expect(prepareFlyingCarPhoto(original, () => {})).rejects.toThrow(/301.*5999|300.*6000/);
    expect(close).toHaveBeenCalledTimes(2);
  });
  it('discards a prepared photo when the account changes during dimension decoding', async () => {
    let current = true;
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      current = false;
      return { width: 800, height: 600, close };
    }));
    await expect(prepareFlyingCarPhoto(photo(), () => {
      if (!current) throw new Error('Account changed');
    })).rejects.toThrow('Account changed');
    expect(close).toHaveBeenCalledOnce();
  });
  it('supports the Image fallback and releases its temporary object URL', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    let released = false;
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { released = true; });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:reference-photo');
    class BrowserImage {
      naturalWidth = 800; naturalHeight = 600;
      onload: (() => void) | null = null; onerror: (() => void) | null = null;
      set src(value: string) { if (value) queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal('Image', BrowserImage);
    const file = photo();
    expect(await prepareFlyingCarPhoto(file, () => {})).toBe(file);
    expect(create).toHaveBeenCalledWith(file);
    expect(revoke).toHaveBeenCalledWith('blob:reference-photo');
    expect(released).toBe(true);
  });
  it('releases the fallback object URL when the image cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:invalid-photo');
    class InvalidImage {
      onload: (() => void) | null = null; onerror: (() => void) | null = null;
      set src(value: string) { if (value) queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal('Image', InvalidImage);
    await expect(prepareFlyingCarPhoto(photo(), () => {})).rejects.toThrow(/read.*photo/i);
    expect(revoke).toHaveBeenCalledWith('blob:invalid-photo');
  });
  it('shows a readable validation error if neither decoder can read the photo', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Decode failed')));
    vi.stubGlobal('Image', undefined);
    await expect(prepareFlyingCarPhoto(photo(), () => {})).rejects.toThrow(/read.*photo|valid.*photo/i);
  });
});
