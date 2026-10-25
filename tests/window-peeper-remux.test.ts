import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  ALL_FORMATS, BufferSource, BufferTarget, CustomSource, EncodedPacket, EncodedPacketSink,
  EncodedVideoPacketSource, Input, Mp4OutputFormat, Output,
} from 'mediabunny';
import { describe, expect, it } from 'vitest';
import { replaceWindowPeeperAudio, WindowPeeperRemuxError } from '../lib/server/window-peeper-remux';

const fixture = async (name: string) => new Uint8Array(await readFile(new URL(`./fixtures/window-peeper-audio/${name}`, import.meta.url)));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function inspect(bytes: Uint8Array) {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  try {
    const result = [];
    for (const track of await input.getTracks()) {
      const packets = [];
      for await (const packet of new EncodedPacketSink(track).packets()) {
        packets.push({ hash: sha(packet.data), timestamp: packet.timestamp, duration: packet.duration, type: packet.type });
      }
      result.push({
        type: track.type, codec: await track.getCodec(), duration: await track.computeDuration(), packets,
        matrix: track.isVideoTrack() ? await track.getTransformationMatrix() : null,
        width: track.isVideoTrack() ? await track.getCodedWidth() : null,
        height: track.isVideoTrack() ? await track.getCodedHeight() : null,
      });
    }
    return result;
  } finally { input.dispose(); }
}

function collect(onWrite?: () => void | Promise<void>) {
  const chunks: Uint8Array[] = [];
  const state = { closed: false, aborted: false };
  const target = new WritableStream<Uint8Array>({
    async write(chunk) { chunks.push(chunk.slice()); await onWrite?.(); },
    close() { state.closed = true; },
    abort() { state.aborted = true; },
  });
  return { target, state, bytes: () => new Uint8Array(Buffer.concat(chunks)) };
}

// Create a valid length-prefixed AVC filler NAL on demand; no large binary is committed.
async function videoWithOversizedKeyPacket() {
  const input = new Input({ source: new BufferSource(await fixture('source-avc-no-audio.mp4')), formats: ALL_FORMATS });
  try {
    const track = (await input.getPrimaryVideoTrack())!;
    const config = (await track.getDecoderConfig())!;
    const destination = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: destination });
    const source = new EncodedVideoPacketSource('avc');
    output.addVideoTrack(source);
    await output.start();
    let first = true;
    for await (const packet of new EncodedPacketSink(track).packets()) {
      if (first) {
        const nalLength = 16 * 1024 * 1024 + 2;
        const data = new Uint8Array(packet.data.byteLength + 4 + nalLength);
        data.set(packet.data);
        new DataView(data.buffer).setUint32(packet.data.byteLength, nalLength);
        data[packet.data.byteLength + 4] = 0x0c; // AVC filler_data NAL.
        data.fill(0xff, packet.data.byteLength + 5, data.byteLength - 1);
        data[data.byteLength - 1] = 0x80; // rbsp_trailing_bits.
        await source.add(new EncodedPacket(data, packet.type, packet.timestamp, packet.duration, packet.sequenceNumber), { decoderConfig: config });
      } else {
        await source.add(packet);
      }
      first = false;
    }
    source.close();
    await output.finalize();
    return new Uint8Array(destination.buffer!);
  } finally { input.dispose(); }
}

describe('Window Peeper fixed soundtrack remux', () => {
  it('copies AVC packets with their PTS, dimensions and rotation intact', async () => {
    const video = await fixture('video-with-audio.mp4');
    const original = (await inspect(video)).find(track => track.type === 'video')!;
    // The successful input has no frame reordering; display transforms must still survive packet copying.
    expect(original.packets).toHaveLength(60);
    expect(original.packets.some((packet, i) => i > 0 && packet.timestamp < original.packets[i - 1].timestamp)).toBe(false);
    expect(original.matrix).toEqual([0, 1, 0, -1, 0, 0, 0, 0, 1]);
    const sink = collect();
    const result = await replaceWindowPeeperAudio(new BufferSource(video), await fixture('soundtrack.m4a'), sink.target, new AbortController().signal);
    const output = await inspect(sink.bytes());
    expect(output.map(track => track.type).sort()).toEqual(['audio', 'video']);
    const copied = output.find(track => track.type === 'video')!;
    expect(copied.codec).toBe('avc');
    expect([copied.width, copied.height]).toEqual([64, 48]);
    expect(copied.matrix).toEqual(original.matrix);
    expect(copied.packets.map(packet => [packet.hash, packet.type])).toEqual(original.packets.map(packet => [packet.hash, packet.type]));
    for (let i = 0; i < original.packets.length; i++) {
      expect(copied.packets[i].timestamp).toBeCloseTo(original.packets[i].timestamp, 5);
      expect(copied.packets[i].duration).toBeCloseTo(original.packets[i].duration, 5);
    }
    expect(result.duration).toBeCloseTo(15, 5);
    expect(copied.duration).toBeCloseTo(15, 5);
    expect(sink.state).toEqual({ closed: true, aborted: false });
  });

  it('replaces model audio with the fixed AAC packet sequence and trims its 16 seconds to the video end', async () => {
    const video = await fixture('video-with-audio.mp4');
    const soundtrack = await fixture('soundtrack.m4a');
    const fixed = (await inspect(soundtrack)).find(track => track.type === 'audio')!;
    const model = (await inspect(video)).find(track => track.type === 'audio')!;
    expect(fixed.duration).toBeCloseTo(16, 5);
    expect(fixed.packets[0].timestamp).toBeLessThan(0); // AAC encoder priming is part of the fixture.
    const sink = collect();
    await replaceWindowPeeperAudio(new BufferSource(video), soundtrack, sink.target, new AbortController().signal);
    const tracks = await inspect(sink.bytes());
    const audio = tracks.filter(track => track.type === 'audio');
    expect(audio).toHaveLength(1);
    expect(audio[0].codec).toBe('aac');
    const expectedPackets = fixed.packets.filter(packet => packet.timestamp + packet.duration <= 15);
    expect(audio[0].packets.map(packet => packet.hash)).toEqual(expectedPackets.map(packet => packet.hash));
    expect(audio[0].packets.map(packet => packet.hash)).not.toEqual(model.packets.map(packet => packet.hash));
    for (let i = 0; i < expectedPackets.length; i++) {
      expect(audio[0].packets[i].timestamp).toBeCloseTo(expectedPackets[i].timestamp, 5);
    }
    expect(audio[0].duration).toBeGreaterThanOrEqual(14.97);
    expect(audio[0].duration).toBeLessThanOrEqual(15.03);
  });

  it('adds the fixed soundtrack when the provider MP4 has no audio track', async () => {
    const video = await fixture('source-avc-no-audio.mp4');
    const original = await inspect(video);
    expect(original.map(track => track.type)).toEqual(['video']);
    const sink = collect();
    await replaceWindowPeeperAudio(new BufferSource(video), await fixture('soundtrack.m4a'), sink.target, new AbortController().signal);
    const output = await inspect(sink.bytes());
    expect(output.map(track => track.type).sort()).toEqual(['audio', 'video']);
    expect(output.find(track => track.type === 'video')!.packets.map(packet => packet.hash)).toEqual(original[0].packets.map(packet => packet.hash));
  });

  it('rejects a video outside the accepted duration instead of producing a paid-looking partial result', async () => {
    const sink = collect();
    await expect(replaceWindowPeeperAudio(new BufferSource(await fixture('short-avc.mp4')), await fixture('soundtrack.m4a'), sink.target, new AbortController().signal)).rejects.toThrow();
    expect(sink.state).toEqual({ closed: false, aborted: true });
  });

  it('rejects reordered B-frame input before writing because fragmented CTO shifts browser playback', async () => {
    const video = await fixture('video-with-bframes.mp4');
    const track = (await inspect(video)).find(track => track.type === 'video')!;
    expect(track.packets.some((packet, i) => i > 0 && packet.timestamp < track.packets[i - 1].timestamp)).toBe(true);
    const sink = collect();
    await expect(replaceWindowPeeperAudio(new BufferSource(video), await fixture('soundtrack.m4a'), sink.target, new AbortController().signal)).rejects.toBeInstanceOf(WindowPeeperRemuxError);
    expect(sink.bytes()).toHaveLength(0);
    expect(sink.state).toEqual({ closed: false, aborted: true });
  });

  it('disposes the input and aborts the output when cancellation precedes processing', async () => {
    const bytes = await fixture('video-with-audio.mp4');
    let disposed = false;
    const source = new CustomSource({ getSize: () => bytes.byteLength, read: (start, end) => bytes.slice(start, end), dispose: () => { disposed = true; } });
    const controller = new AbortController();
    controller.abort(new Error('canceled by test'));
    const sink = collect();
    await expect(replaceWindowPeeperAudio(source, await fixture('soundtrack.m4a'), sink.target, controller.signal)).rejects.toThrow();
    expect(disposed).toBe(true);
    expect(sink.bytes()).toHaveLength(0);
    expect(sink.state).toEqual({ closed: false, aborted: true });
  });

  it('aborts rather than completing a stream canceled during output', async () => {
    const controller = new AbortController();
    const sink = collect(() => { controller.abort(new Error('canceled during write')); });
    await expect(replaceWindowPeeperAudio(new BufferSource(await fixture('video-with-audio.mp4')), await fixture('soundtrack.m4a'), sink.target, controller.signal)).rejects.toThrow();
    expect(sink.state).toEqual({ closed: false, aborted: true });
  });

  it.each(['video', 'soundtrack'])('rejects corrupt %s bytes and aborts the destination', async corrupted => {
    const invalid = new Uint8Array([1, 2, 3, 4, 5]);
    const video = corrupted === 'video' ? invalid : await fixture('video-with-audio.mp4');
    const soundtrack = corrupted === 'soundtrack' ? invalid : await fixture('soundtrack.m4a');
    const sink = collect();
    await expect(replaceWindowPeeperAudio(new BufferSource(video), soundtrack, sink.target, new AbortController().signal)).rejects.toBeInstanceOf(WindowPeeperRemuxError);
    expect(sink.state).toEqual({ closed: false, aborted: true });
  });

  it('rejects a truncated mdat even when the intact moov still advertises a complete 15-second video', async () => {
    const fullVideo = await fixture('video-with-audio.mp4');
    const truncated = fullVideo.slice(0, Math.floor(fullVideo.byteLength / 2));
    const input = new Input({ source: new BufferSource(truncated), formats: ALL_FORMATS });
    try {
      expect(await (await input.getPrimaryVideoTrack())!.computeDuration()).toBeCloseTo(15, 5);
    } finally { input.dispose(); }
    const sink = collect();
    await expect(replaceWindowPeeperAudio(new BufferSource(truncated), await fixture('soundtrack.m4a'), sink.target, new AbortController().signal)).rejects.toBeInstanceOf(WindowPeeperRemuxError);
    expect(sink.state).toEqual({ closed: false, aborted: true });
  });

  it('rejects a truncated fixed soundtrack instead of silently leaving the last part of the video without audio', async () => {
    const fullSoundtrack = await fixture('soundtrack.m4a');
    const soundtrack = fullSoundtrack.slice(0, Math.floor(fullSoundtrack.byteLength / 2));
    const sink = collect();
    await expect(replaceWindowPeeperAudio(new BufferSource(await fixture('video-with-audio.mp4')), soundtrack, sink.target, new AbortController().signal)).rejects.toBeInstanceOf(WindowPeeperRemuxError);
    expect(sink.state).toEqual({ closed: false, aborted: true });
  });

  it('preserves a source network Error instead of classifying it as unsupported media', async () => {
    const marker = new Error('synthetic R2 range read failed');
    let disposed = false;
    const source = new CustomSource({
      getSize: () => 59134,
      read() { throw marker; },
      dispose() { disposed = true; },
    });
    const sink = collect();
    await expect(replaceWindowPeeperAudio(source, await fixture('soundtrack.m4a'), sink.target, new AbortController().signal)).rejects.toBe(marker);
    expect(marker).not.toBeInstanceOf(WindowPeeperRemuxError);
    expect(disposed).toBe(true);
    expect(sink.state).toEqual({ closed: false, aborted: true });
  });

  it('preserves a destination write Error instead of classifying it as unsupported media', async () => {
    const marker = new Error('synthetic R2 multipart write failed');
    let closed = false;
    const target = new WritableStream<Uint8Array>({ write() { throw marker; }, close() { closed = true; } });
    await expect(replaceWindowPeeperAudio(new BufferSource(await fixture('video-with-audio.mp4')), await fixture('soundtrack.m4a'), target, new AbortController().signal)).rejects.toBe(marker);
    expect(marker).not.toBeInstanceOf(WindowPeeperRemuxError);
    expect(closed).toBe(false);
  });

  it('waits for a slow destination and finishes with serialized writes and a complete MP4', async () => {
    let start!: () => void;
    let release!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    let active = 0, maximumActive = 0, writes = 0, settled = false;
    const sink = collect(async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      if (++writes === 1) { start(); await blocked; }
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
    });
    const operation = replaceWindowPeeperAudio(new BufferSource(await fixture('video-with-audio.mp4')), await fixture('soundtrack.m4a'), sink.target, new AbortController().signal);
    void operation.then(() => { settled = true; }, () => { settled = true; });
    try {
      await started;
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(settled).toBe(false);
      expect(sink.state.closed).toBe(false);
    } finally { release(); }
    await operation;
    expect(maximumActive).toBe(1);
    expect(active).toBe(0);
    expect(writes).toBeGreaterThan(1);
    expect(sink.state).toEqual({ closed: true, aborted: false });
    expect((await inspect(sink.bytes())).map(track => track.type).sort()).toEqual(['audio', 'video']);
  });

  it('aborts a valid AVC input whose pending encoded key packet exceeds the 16 MiB budget', async () => {
    const video = await videoWithOversizedKeyPacket();
    const input = new Input({ source: new BufferSource(video), formats: ALL_FORMATS });
    try {
      const track = (await input.getPrimaryVideoTrack())!;
      expect(await track.getCodec()).toBe('avc');
      expect(await track.computeDuration()).toBeCloseTo(15, 5);
      expect((await new EncodedPacketSink(track).getFirstPacket())!.byteLength).toBeGreaterThan(16 * 1024 * 1024);
    } finally { input.dispose(); }
    const sink = collect();
    await expect(replaceWindowPeeperAudio(new BufferSource(video), await fixture('soundtrack.m4a'), sink.target, new AbortController().signal)).rejects.toBeInstanceOf(WindowPeeperRemuxError);
    expect(sink.state).toEqual({ closed: false, aborted: true });
    expect(sink.bytes().byteLength).toBeLessThan(1024 * 1024);
  });
});
