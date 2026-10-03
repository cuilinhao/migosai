import { afterEach, describe, expect, it, vi } from "vitest";
import { preparePhoto } from "./prepare-photo";

const MIB = 1024 * 1024;
const original = (name = "photo.jpg", type = "image/jpeg", size = MIB + 1) =>
  new File([new Uint8Array(size)], name, { type, lastModified: 123456789 });

function browserImage(width: number, height: number, outputSize: number | null) {
  const close = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback, type: string) =>
    callback(outputSize === null ? null : new Blob([new Uint8Array(outputSize)], { type })));
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage: vi.fn() })), toBlob };
  const createImageBitmap = vi.fn(async () => ({ width, height, close }));
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  return { canvas, close, createImageBitmap, toBlob };
}

afterEach(() => vi.unstubAllGlobals());

describe("preparePhoto", () => {
  it("returns images at or below 1 MiB unchanged without decoding", async () => {
    const file = original("small.jpg", "image/jpeg", MIB);
    const createImageBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    expect(await preparePhoto(file)).toBe(file);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("scales a large image to 2048 pixels on its long edge and preserves its ratio", async () => {
    const image = browserImage(4000, 2000, 100_000);
    const file = original("portrait.jpeg");
    const result = await preparePhoto(file);
    expect([image.canvas.width, image.canvas.height]).toEqual([2048, 1024]);
    expect(result).not.toBe(file);
    expect(result.name).toBe("portrait.jpeg");
    expect(result.type).toBe("image/jpeg");
    expect(result.lastModified).toBe(123456789);
    expect(result.size).toBe(100_000);
    expect(image.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.9);
    expect(image.close).toHaveBeenCalledOnce();
  });

  it("does not enlarge a large file whose dimensions are already within 2048", async () => {
    const image = browserImage(1000, 500, 100_000);
    await preparePhoto(original());
    expect([image.canvas.width, image.canvas.height]).toEqual([1000, 500]);
  });

  it.each([
    ["transparent.png", "image/png"],
    ["transparent.webp", "image/webp"],
  ])("keeps %s in its original format", async (name, type) => {
    const image = browserImage(3000, 1500, 100_000);
    const result = await preparePhoto(original(name, type));
    expect(result.type).toBe(type);
    expect(result.name).toBe(name);
    expect(image.toBlob).toHaveBeenCalledWith(expect.any(Function), type, undefined);
    expect(image.close).toHaveBeenCalledOnce();
  });

  it("returns the original if encoding makes the image larger", async () => {
    const image = browserImage(3000, 1500, MIB + 2);
    const file = original();
    expect(await preparePhoto(file)).toBe(file);
    expect(image.close).toHaveBeenCalledOnce();
  });

  it("returns the original after decode or canvas failures", async () => {
    const file = original();
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("bad image")));
    expect(await preparePhoto(file)).toBe(file);
    const image = browserImage(3000, 1500, null);
    expect(await preparePhoto(file)).toBe(file);
    expect(image.close).toHaveBeenCalledOnce();
    const unsupportedCanvas = browserImage(3000, 1500, 100_000);
    unsupportedCanvas.canvas.getContext.mockReturnValue(null as never);
    expect(await preparePhoto(file)).toBe(file);
    expect(unsupportedCanvas.close).toHaveBeenCalledOnce();
    vi.stubGlobal("createImageBitmap", undefined);
    expect(await preparePhoto(file)).toBe(file);
  });
});
