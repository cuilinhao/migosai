import {
  AppendOnlyStreamTarget, BufferSource, EncodedAudioPacketSource, EncodedPacketSink,
  EncodedVideoPacketSource, Input, MP4, Mp4OutputFormat, Output, UnsupportedInputFormatError,
  type EncodedPacket, type Source,
} from 'mediabunny';

const MAX_PENDING_PACKET_BYTES = 16 * 1024 * 1024;
const AUDIO_FRAME_TOLERANCE = 0.03;

/** A definitive media/format limit failure, distinct from source or destination I/O. */
export class WindowPeeperRemuxError extends Error {
  override name = 'WindowPeeperRemuxError';
}

// Count sequential mdat payload without onMdat's extra copy of each fragment.
function mediaByteCounter() {
  const header = new Uint8Array(16);
  let used = 0, headerSize = 8, remaining = 0, media = false;
  return {
    consume(data: Uint8Array): number {
      let offset = 0, bytes = 0;
      while (offset < data.byteLength) {
        if (remaining > 0) {
          const size = Math.min(remaining, data.byteLength - offset);
          if (media) bytes += size;
          remaining -= size;
          offset += size;
          continue;
        }
        const size = Math.min(headerSize - used, data.byteLength - offset);
        header.set(data.subarray(offset, offset + size), used);
        used += size;
        offset += size;
        if (used < headerSize) continue;
        const view = new DataView(header.buffer);
        let boxSize = view.getUint32(0);
        if (boxSize === 1 && headerSize === 8) {
          headerSize = 16;
          continue;
        }
        if (headerSize === 16) {
          const largeSize = view.getBigUint64(8);
          if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) throw new WindowPeeperRemuxError('Invalid output box size.');
          boxSize = Number(largeSize);
        }
        if (boxSize < headerSize) throw new WindowPeeperRemuxError('Invalid output box size.');
        media = view.getUint32(4) === 0x6d646174;
        remaining = boxSize - headerSize;
        used = 0;
        headerSize = 8;
      }
      return bytes;
    },
    finish() {
      if (used || remaining) throw new WindowPeeperRemuxError('Incomplete remuxed media.');
    },
  };
}

/** Owns/disposes videoSource; the caller completes R2 only after successful return. */
export async function replaceWindowPeeperAudio(
  videoSource: Source,
  soundtrack: Uint8Array,
  target: WritableStream<Uint8Array>,
  signal: AbortSignal,
): Promise<{ duration: number }> {
  const videoInput = new Input({ source: videoSource, formats: [MP4] });
  let audioInput: Input | undefined;
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  let output: Output | undefined;
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  void aborted.catch(() => {});
  const onAbort = () => {
    videoInput.dispose();
    audioInput?.dispose();
    rejectAbort(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  };
  signal.addEventListener('abort', onAbort, { once: true });
  const wait = async <T>(operation: Promise<T>): Promise<T> => {
    signal.throwIfAborted();
    return Promise.race([operation, aborted]);
  };

  try {
    writer = target.getWriter();
    signal.throwIfAborted();
    audioInput = new Input({ source: new BufferSource(soundtrack), formats: [MP4] });
    const videoTracks = await wait(videoInput.getVideoTracks());
    if (videoTracks.length !== 1 || await wait(videoTracks[0].getCodec()) !== 'avc') {
      throw new WindowPeeperRemuxError('Window Peeper requires exactly one AVC video track.');
    }
    const videoTrack = videoTracks[0];
    const duration = await wait(videoTrack.computeDuration());
    if (!Number.isFinite(duration) || duration < 14 || duration > 16) {
      throw new WindowPeeperRemuxError('Window Peeper video duration must be between 14 and 16 seconds.');
    }
    const videoConfig = await wait(videoTrack.getDecoderConfig());
    if (!videoConfig) throw new WindowPeeperRemuxError('The video decoder configuration is missing.');

    // Mediabunny 1.61's fragmented negative CTO is shifted by Chrome/FFmpeg.
    // Reject reordered video before writing; silently shifting it would break A/V sync.
    const videoSink = new EncodedPacketSink(videoTrack);
    let metadataPacket = await wait(videoSink.getFirstPacket({ metadataOnly: true }));
    let previousTimestamp = -Infinity;
    let expectedVideoPackets = 0, expectedVideoBytes = 0;
    while (metadataPacket) {
      if (metadataPacket.timestamp < previousTimestamp) {
        throw new WindowPeeperRemuxError('Reordered video frames are not supported by the streaming MP4 muxer.');
      }
      expectedVideoPackets++;
      expectedVideoBytes += metadataPacket.byteLength;
      previousTimestamp = metadataPacket.timestamp;
      metadataPacket = await wait(videoSink.getNextPacket(metadataPacket, { metadataOnly: true }));
    }

    // This source is an in-memory asset: parsing failures cannot be R2/network errors.
    const audio = await (async () => {
      try {
        const tracks = await wait(audioInput!.getAudioTracks());
        if (tracks.length !== 1 || await wait(tracks[0].getCodec()) !== 'aac') {
          throw new WindowPeeperRemuxError('The fixed soundtrack must contain exactly one AAC audio track.');
        }
        const track = tracks[0];
        const config = await wait(track.getDecoderConfig());
        const end = await wait(track.computeDuration());
        if (!config || !Number.isFinite(end) || end < duration) {
          throw new WindowPeeperRemuxError('The fixed soundtrack does not cover the video duration.');
        }
        return { track, config };
      } catch (error) {
        if (signal.aborted || error instanceof WindowPeeperRemuxError) throw error;
        throw new WindowPeeperRemuxError('The fixed soundtrack is not a readable AAC MP4 asset.');
      }
    })();

    let submittedBytes = 0, drainedBytes = 0;
    const counter = mediaByteCounter();
    const destination = writer;
    // Mediabunny closes targets during cancellation too. The bridge must not
    // close the caller's stream; only successful finalization does that.
    const bridge = new WritableStream<Uint8Array>({
      async write(data) {
        signal.throwIfAborted();
        const mediaBytes = counter.consume(data);
        await wait(destination.write(data));
        drainedBytes += mediaBytes;
      },
    });
    output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'fragmented', minimumFragmentDuration: 1 }),
      target: new AppendOnlyStreamTarget(bridge),
    });
    const video = new EncodedVideoPacketSource('avc');
    const fixedAudio = new EncodedAudioPacketSource('aac');
    output.addVideoTrack(video, { transformationMatrix: await wait(videoTrack.getTransformationMatrix()) });
    output.addAudioTrack(fixedAudio);
    await wait(output.start());

    const audioSink = new EncodedPacketSink(audio.track);
    let videoPacket = await wait(videoSink.getFirstPacket());
    let audioPacket = await wait(audioSink.getFirstPacket());
    if (!videoPacket || !audioPacket) throw new WindowPeeperRemuxError('Media packets are missing.');
    let firstVideo = true, firstAudio = true;
    let copiedVideoPackets = 0, copiedVideoBytes = 0;
    let copiedAudioEnd = -Infinity;
    while (videoPacket || audioPacket) {
      signal.throwIfAborted();
      // Keep encoder priming, but never include a partial final AAC frame.
      // This also bounds the MP4 duration's priming allowance to one AAC frame.
      if (audioPacket && audioPacket.timestamp + audioPacket.duration > duration) {
        audioPacket = null;
        fixedAudio.close();
        continue;
      }
      // Interleave the two head packets without retaining either whole track.
      const useVideo: boolean = !!videoPacket && (!audioPacket || videoPacket.timestamp <= audioPacket.timestamp);
      const packet: EncodedPacket = useVideo ? videoPacket! : audioPacket!;
      if (packet.data.byteLength !== packet.byteLength) {
        throw new WindowPeeperRemuxError('An input media packet is incomplete.');
      }
      submittedBytes += packet.byteLength;
      if (submittedBytes - drainedBytes > MAX_PENDING_PACKET_BYTES) {
        throw new WindowPeeperRemuxError('The video needs more than 16 MiB of buffered media packets.');
      }
      if (useVideo) {
        await wait(video.add(packet, firstVideo ? { decoderConfig: videoConfig } : undefined));
        copiedVideoPackets++;
        copiedVideoBytes += packet.data.byteLength;
        firstVideo = false;
        videoPacket = await wait(videoSink.getNextPacket(packet));
        if (!videoPacket) video.close();
      } else {
        if (packet.duration > AUDIO_FRAME_TOLERANCE || packet.duration <= 0) {
          throw new WindowPeeperRemuxError('The fixed soundtrack AAC frame duration is unsupported.');
        }
        await wait(fixedAudio.add(packet, firstAudio ? { decoderConfig: audio.config } : undefined));
        copiedAudioEnd = packet.timestamp + packet.duration;
        firstAudio = false;
        audioPacket = await wait(audioSink.getNextPacket(packet));
        if (!audioPacket) fixedAudio.close();
      }
    }
    if (copiedVideoPackets !== expectedVideoPackets || copiedVideoBytes !== expectedVideoBytes) {
      throw new WindowPeeperRemuxError('The provider video does not contain every declared video packet.');
    }
    if (copiedAudioEnd < duration - AUDIO_FRAME_TOLERANCE) {
      throw new WindowPeeperRemuxError('The fixed soundtrack packets do not cover the video duration.');
    }
    await wait(output.finalize());
    counter.finish();
    await wait(writer.close());
    return { duration };
  } catch (error) {
    const cleanup = Promise.all([
      output?.state !== 'finalized' ? output?.cancel().catch(() => {}) : undefined,
      writer?.abort(error).catch(() => {}),
    ]);
    // An unresponsive destination must not prevent cancellation from settling.
    await Promise.race([cleanup, aborted.catch(() => {})]);
    if (signal.aborted) signal.throwIfAborted();
    if (error instanceof UnsupportedInputFormatError) {
      throw new WindowPeeperRemuxError('The provider video is not a readable MP4 file.');
    }
    throw error;
  } finally {
    signal.removeEventListener('abort', onAbort);
    videoInput.dispose();
    audioInput?.dispose();
    writer?.releaseLock();
  }
}
