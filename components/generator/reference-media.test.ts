import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as bunny from "mediabunny";
import { inspectReference, prepareReference, referenceDimensions, referenceWindow } from "./reference-media";

// Real PCM fixtures detect accepting forged MIME types or using total duration as clip length.
function wave(seconds: number) {
  const frames = Math.round(seconds * 44100);
  const bytes = new Uint8Array(44 + frames * 4);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 2, true); view.setUint32(24, 44100, true); view.setUint32(28, 176400, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, frames * 4, true);
  for (let frame = 0; frame < frames; frame++) {
    const sample = frame < 4 * 44100 ? 1000 : 2000;
    view.setInt16(44 + frame * 4, sample, true); view.setInt16(46 + frame * 4, sample, true);
  }
  return new File([bytes], "source.wav", { type: "audio/wav" });
}

afterEach(() => vi.restoreAllMocks());

async function motionWithShortAudio(audioSeconds = 1, videoSeconds = 4) {
  const videoInput = new bunny.Input({ source: new bunny.BlobSource(new Blob([readFileSync("tests/fixtures/reference-media/silent.mp4")])), formats: bunny.ALL_FORMATS });
  const audioInput = new bunny.Input({ source: new bunny.BlobSource(wave(audioSeconds)), formats: bunny.ALL_FORMATS });
  const output = new bunny.Output({ target: new bunny.BufferTarget(), format: new bunny.MovOutputFormat() });
  try {
    const video = await bunny.Conversion.init({ input: videoInput, output, composable: true, trim: { start: 0, end: videoSeconds }, copy: { mode: "forced" }, audio: { discard: true } });
    const audio = await bunny.Conversion.init({ input: audioInput, output, composable: true, copy: { mode: "forced" }, video: { discard: true } });
    await output.start(); await video.execute(); await audio.execute(); await output.finalize();
    return new File([output.target.buffer!], "short-audio.mov", { type: "video/quicktime" });
  } finally { videoInput.dispose(); audioInput.dispose(); }
}

function replaceBrowserVideoEncoding() {
  const original = bunny.Conversion.init.bind(bunny.Conversion);
  // Node has no native VideoEncoder. Supply an actual silent MP4 of the chosen
  // length, while keeping input parsing and selected-region PCM extraction real.
  vi.spyOn(bunny.Conversion, "init").mockImplementation(async options => {
    if (typeof options.audio === "object" && !Array.isArray(options.audio) && options.audio?.discard) {
      return original({ ...options, trim: { start: 0, end: (options.trim!.end! - options.trim!.start!) }, video: { codec: "avc" }, copy: { mode: "forced" } });
    }
    return original(options);
  });
}

describe("reference time windows", () => {
  it("keeps a nonzero start and an exact selected end", () => {
    expect(referenceWindow(60, "audio", 17.3, 22.3)).toEqual({ start: 17.3, end: 22.3, duration: 5 });
  });
  it("leaves frame rounding room for a 15-second video selection", () => {
    expect(referenceWindow(60, "video", 10, 25)).toEqual({ start: 10, end: 24.9, duration: 14.9 });
  });
  it.each([[60, -1, 4], [60, 5, 4], [60, 0, 1.99], [60, 0, 15.1], [8, 6, 9], [NaN, 0, 3]])(
    "rejects invalid or out-of-source windows (%s, %s, %s)", (duration, start, end) => {
      expect(() => referenceWindow(duration, "audio", start, end)).toThrow();
    });
  it("accepts the minimum 2 seconds at the very end of the source", () => {
    expect(referenceWindow(8, "video", 6, 8)).toEqual({ start: 6, end: 8, duration: 2 });
  });
});

describe("reference video dimensions", () => {
  it.each([[3840, 2160, 1280, 720], [1080, 1920, 720, 1280], [600, 600, 720, 720], [256, 640, 720, 1280]])(
    "fits %sx%s into 720p with an adequate short edge", (width, height, outWidth, outHeight) => {
      expect(referenceDimensions(width, height)).toEqual({ width: outWidth, height: outHeight });
    });
  it.each([[1920, 200], [100, 100], [Infinity, 720]])("rejects unsupported %sx%s", (width, height) => {
    expect(() => referenceDimensions(width, height)).toThrow();
  });
});

describe("reference media inspection", () => {
  it("reads the duration and tracks from a real WAV instead of the filename", async () => {
    expect(await inspectReference(wave(3), "audio")).toEqual({ duration: 3, hasAudio: true });
  });
  it("rejects audio supplied as a motion video", async () => {
    await expect(inspectReference(wave(3), "video")).rejects.toThrow();
  });
  it("rejects bytes pretending to be an audio file", async () => {
    await expect(inspectReference(new File(["invalid"], "song.wav", { type: "audio/wav" }), "audio")).rejects.toThrow();
  });
  it("rejects a source shorter than the minimum clip", async () => {
    await expect(inspectReference(wave(1), "audio")).rejects.toThrow();
  });
  it("honors cancellation before decoding or reporting progress", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(prepareReference(wave(3), "audio", 0, 3, undefined, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("detects that a real silent MP4 cannot provide clip sound", async () => {
    const bytes = readFileSync("tests/fixtures/reference-media/silent.mp4");
    const info = await inspectReference(new File([bytes], "motion.mp4", { type: "video/mp4" }), "video");
    expect(info.hasAudio).toBe(false);
    expect(info.duration).toBeCloseTo(4, 1);
    expect([info.width, info.height]).toEqual([640, 480]);
  });
  it("converts a nonzero PCM source interval to a stereo 44100 Hz WAV", async () => {
    const result = await prepareReference(wave(8), "audio", 3, 5);
    expect(result.duration).toBeCloseTo(2, 3);
    expect(result.start).toBe(3);
    expect(result.audioFile).toBeUndefined();
    const header = new DataView(await result.file.arrayBuffer());
    expect(header.getUint16(20, true)).toBe(1);
    expect(header.getUint16(22, true)).toBe(2);
    expect(header.getUint32(24, true)).toBe(44100);
    expect(header.getUint16(34, true)).toBe(16);
    // Source seconds 3–4 have amplitude 1000, seconds 4–5 amplitude 2000.
    // Cutting from zero or copying the entire file cannot satisfy both.
    expect(header.getInt16(44, true)).toBe(1000);
    expect(header.getInt16(44 + 44100 * 4, true)).toBe(2000);
  });
  it.each([[0, 4], [2, 4]])("keeps motion usable when its selected %s–%s second region has less than 2 seconds of audio", async (start, end) => {
    const file = await motionWithShortAudio();
    replaceBrowserVideoEncoding();
    const prepared = await prepareReference(file, "video", start, end);
    expect(prepared.file.type).toBe("video/mp4");
    expect(prepared.duration).toBeCloseTo(end - start, 1);
    expect(prepared.audioFile).toBeUndefined();
    expect(prepared.hasAudio).toBe(false);
    expect((await inspectReference(prepared.file, "video")).hasAudio).toBe(false);
  });
  it("disables clip sound when a valid WAV does not cover the selected movement", async () => {
    const file = await motionWithShortAudio(3);
    replaceBrowserVideoEncoding();
    const prepared = await prepareReference(file, "video", 0, 4);
    expect(prepared.duration).toBeCloseTo(4, 1);
    expect(prepared.audioFile).toBeUndefined();
    expect(prepared.hasAudio).toBe(false);
  });
  it("keeps usable source sound when it covers the selected movement", async () => {
    const file = await motionWithShortAudio(4);
    replaceBrowserVideoEncoding();
    const prepared = await prepareReference(file, "video", 0, 4);
    expect(prepared.hasAudio).toBe(true);
    expect((await inspectReference(prepared.audioFile!, "audio")).duration).toBeCloseTo(4, 3);
  });
  it("does not return a prepared motion if cancelled while extracting its optional sound", async () => {
    const file = await motionWithShortAudio();
    replaceBrowserVideoEncoding();
    const controller = new AbortController();
    await expect(prepareReference(file, "video", 0, 4, n => { if (n > 0.75) controller.abort(); }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("still rejects a failed video conversion even if its audio was optional", async () => {
    const file = await motionWithShortAudio();
    vi.spyOn(bunny.Conversion, "init").mockRejectedValue(new Error("Native video encoder failed"));
    await expect(prepareReference(file, "video", 0, 4)).rejects.toThrow();
  });
  it("retains the source and selected window so remounting can edit beyond the old clip", async () => {
    const file = wave(8);
    const prepared = await prepareReference(file, "audio", 3, 5);
    expect(prepared.sourceFile).toBe(file);
    expect(prepared.sourceMetadata?.duration).toBe(8);
    expect(prepared.selectedDuration).toBe(2);
    expect(prepared.start).toBe(3);
  });
  it("returns millisecond precision before a fractional clip is rounded to output seconds", async () => {
    const prepared = await prepareReference(wave(3), "audio", 0, 2.4997);
    expect(prepared.duration).toBe(2.5);
    expect(Math.round(prepared.duration)).toBe(3);
    expect((await inspectReference(prepared.file, "audio")).duration).toBeCloseTo(2.4997, 4);
  });
  it("disables source sound that covers fractional motion but not its rounded output length", async () => {
    const file = await motionWithShortAudio(3.4, 3.6);
    replaceBrowserVideoEncoding();
    const prepared = await prepareReference(file, "video", 0, 3.6);
    expect(Math.round(prepared.duration)).toBe(4);
    expect(prepared.audioFile).toBeUndefined();
    expect(prepared.hasAudio).toBe(false);
  });
});
