import type { Conversion, Input } from "mediabunny";

export type ReferenceKind = "audio" | "video";
export type PreparedReference = {
  file: File; duration: number; audioFile?: File; hasAudio: boolean; sourceName: string; start: number;
  // Browser-only editing state. Submission uploads `file`/`audioFile`, never this source.
  sourceFile?: File; sourceMetadata?: ReferenceMetadata; selectedDuration?: number;
};
export type ReferenceMetadata = { duration: number; hasAudio: boolean; width?: number; height?: number };
const MIB = 1024 * 1024;
const aborted = () => new DOMException("Media preparation was cancelled.", "AbortError");
const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw aborted(); };
class ReferenceError extends Error {}

export function referenceWindow(sourceDuration: number, kind: ReferenceKind, start: number, end: number) {
  const length = end - start;
  if (![sourceDuration, start, end].every(Number.isFinite) || sourceDuration < 2 || start < 0 || end > sourceDuration + 0.000001 || length < 2 - 0.000001 || length > 15 + 0.000001) {
    throw new ReferenceError("Choose a 2–15 second segment within your file.");
  }
  const duration = Math.round(Math.min(length, kind === "video" ? 14.9 : 15) * 1e6) / 1e6;
  return { start, end: start + duration, duration };
}

export function referenceDimensions(width: number, height: number) {
  if (![width, height].every(Number.isFinite) || Math.min(width, height) < 256 || width / height < 0.4 || width / height > 2.5) {
    throw new ReferenceError("Choose a video at least 256 pixels on each side with a standard aspect ratio.");
  }
  // Providers accept a 480/720-pixel short side. Contain pads unusually wide/tall
  // sources instead of cropping performers or exceeding the 1280-pixel limit.
  const ratio = Math.min(1280 / 720, Math.max(720 / 1280, width / height));
  return width >= height
    ? { width: Math.round(720 * ratio / 2) * 2, height: 720 }
    : { width: 720, height: Math.round(720 / ratio / 2) * 2 };
}

function validateSource(file: File) {
  if (!file.size) throw new ReferenceError("Choose a non-empty audio or video file.");
  if (file.size > 200 * MIB) throw new ReferenceError("The source file must be 200 MB or smaller.");
}

async function metadata(input: Input, kind: ReferenceKind, signal?: AbortSignal): Promise<ReferenceMetadata> {
  const audio = await input.getPrimaryAudioTrack();
  checkAbort(signal);
  const video = kind === "video" ? await input.getPrimaryVideoTrack() : null;
  checkAbort(signal);
  if (kind === "video" && !video) throw new ReferenceError("This file does not contain a video track.");
  if (kind === "audio" && !audio) throw new ReferenceError("This file does not contain an audio track.");
  const duration = await (video ?? audio)!.computeDuration();
  checkAbort(signal);
  if (!Number.isFinite(duration) || duration < 2) throw new ReferenceError("Choose a file that is at least 2 seconds long.");
  if (video) {
    const width = await video.getDisplayWidth();
    const height = await video.getDisplayHeight();
    referenceDimensions(width, height);
    return { duration, hasAudio: Boolean(audio), width, height };
  }
  return { duration, hasAudio: true };
}

export async function inspectReference(file: File, kind: ReferenceKind, signal?: AbortSignal): Promise<ReferenceMetadata> {
  checkAbort(signal);
  validateSource(file);
  const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
  checkAbort(signal);
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const cancel = () => input.dispose();
  signal?.addEventListener("abort", cancel, { once: true });
  try { return await metadata(input, kind, signal); }
  catch (error) {
    checkAbort(signal);
    if (error instanceof ReferenceError) throw error;
    throw new ReferenceError("Could not read this media file. Choose another MP4, WebM, MP3, or WAV file.");
  } finally { signal?.removeEventListener("abort", cancel); input.dispose(); }
}

export async function prepareReference(file: File, kind: ReferenceKind, start: number, end: number, onProgress?: (n: number) => void, signal?: AbortSignal): Promise<PreparedReference> {
  checkAbort(signal);
  validateSource(file);
  const bunny = await import("mediabunny");
  checkAbort(signal);
  const input = new bunny.Input({ source: new bunny.BlobSource(file), formats: bunny.ALL_FORMATS });
  let conversion: Conversion | undefined;
  let cancelPromise: Promise<void> | undefined;
  const cancel = () => { if (conversion) cancelPromise = conversion.cancel().catch(() => undefined); else input.dispose(); };
  signal?.addEventListener("abort", cancel, { once: true });
  const progress = (value: number) => { checkAbort(signal); onProgress?.(Math.min(0.99, Math.max(0, value))); };
  try {
    const source = await metadata(input, kind, signal);
    const window = referenceWindow(source.duration, kind, start, end);
    const stem = file.name.replace(/\.[^.]+$/, "") || "reference";
    progress(0);
    const convert = async (outputKind: ReferenceKind, progressStart: number, progressSize: number) => {
      checkAbort(signal);
      const target = new bunny.BufferTarget();
      const output = new bunny.Output({ format: outputKind === "video" ? new bunny.Mp4OutputFormat({ fastStart: "in-memory" }) : new bunny.WavOutputFormat(), target });
      let oversized = false;
      const limit = (outputKind === "video" ? 20 : 15) * MIB;
      const stopSizeCheck = target.on("write", ({ end: offset }) => {
        if (offset > limit) { oversized = true; if (conversion) cancelPromise = conversion.cancel().catch(() => undefined); }
      });
      try {
        conversion = await bunny.Conversion.init({
          input, output, tracks: "primary", trim: { start: window.start, end: window.end }, copy: false, tags: {}, showWarnings: false,
          video: outputKind === "video" ? { ...referenceDimensions(source.width!, source.height!), fit: "contain", codec: "avc", frameRate: 30, quality: new bunny.Quality(4_000_000), allowTransformationMetadata: false } : { discard: true },
          audio: outputKind === "video" ? { discard: true } : { codec: "pcm-s16", numberOfChannels: 2, sampleRate: 44100, sampleFormat: "s16" },
        });
        checkAbort(signal);
        if (!conversion.isValid) throw new ReferenceError("Your browser cannot convert this file. Try a recent Chrome browser or another MP4, MP3, or WAV file.");
        conversion.onProgress = value => { if (!signal?.aborted) progress(progressStart + value * progressSize); };
        await conversion.execute();
        checkAbort(signal);
        if (!target.buffer?.byteLength) throw new ReferenceError("The selected segment contains no playable media.");
        if (target.buffer.byteLength > limit) oversized = true;
        if (oversized) throw new ReferenceError(outputKind === "video" ? "The prepared video must be 20 MB or smaller. Choose a shorter segment." : "The prepared audio must be 15 MB or smaller. Choose a shorter segment.");
        return new File([target.buffer], `${stem}-clip.${outputKind === "video" ? "mp4" : "wav"}`, { type: outputKind === "video" ? "video/mp4" : "audio/wav" });
      } catch (error) {
        if (oversized) throw new ReferenceError(outputKind === "video" ? "The prepared video must be 20 MB or smaller. Choose a shorter segment." : "The prepared audio must be 15 MB or smaller. Choose a shorter segment.");
        throw error;
      } finally {
        stopSizeCheck();
        if (conversion?.state !== "done") await conversion?.cancel().catch(() => undefined);
        if (output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => undefined);
        conversion = undefined;
      }
    };
    const prepared = await convert(kind, 0, kind === "video" && source.hasAudio ? 0.75 : 0.95);
    // Read the result; a codec may round sample/frame durations at the end.
    const actual = await inspectReference(prepared, kind, signal);
    if (actual.duration > 15 || actual.duration < 2) throw new ReferenceError("The prepared segment must be between 2 and 15 seconds long.");
    const duration = Math.round(actual.duration * 1000) / 1000;
    let audioFile: File | undefined;
    if (kind === "video" && source.hasAudio) {
      try {
        const extracted = await convert("audio", 0.75, 0.2);
        const audio = await inspectReference(extracted, "audio", signal);
        const audioDuration = Math.round(audio.duration * 1000) / 1000;
        if (audio.duration >= 2 && audio.duration <= 15 && audioDuration + 0.55 >= Math.round(duration)) audioFile = extracted;
      } catch (error) {
        // Optional source sound may end before the selected movement or be
        // undecodable. Keep the successfully prepared motion; cancellation is fatal.
        checkAbort(signal);
        if (error instanceof Error && error.name === "AbortError") throw error;
      }
    }
    checkAbort(signal); onProgress?.(1);
    return { file: prepared, duration, ...(audioFile ? { audioFile } : {}), hasAudio: kind === "audio" || Boolean(audioFile), sourceName: file.name, start, sourceFile: file, sourceMetadata: source, selectedDuration: window.duration };
  } catch (error) {
    checkAbort(signal);
    if (error instanceof ReferenceError) throw error;
    throw new ReferenceError("Could not prepare this segment. Try a shorter MP4, MP3, or WAV file in a recent Chrome browser.");
  } finally {
    signal?.removeEventListener("abort", cancel);
    await cancelPromise;
    await conversion?.cancel().catch(() => undefined);
    input.dispose();
  }
}
