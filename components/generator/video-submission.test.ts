import { describe, expect, it, vi } from "vitest";
import type { GenerationResponse } from "@/lib/contracts";
import { captureVideoSubmission, executeVideoSubmission } from "./video-submission";

describe("video submission snapshot", () => {
  it("identifies each photo so parallel upload progress stays on the correct performer", async () => {
    const sameFile = new File(["image"], "same.jpg", { type: "image/jpeg" });
    const snapshot = captureVideoSubmission("sides", "photos", sameFile, sameFile, { aspect: "9:16", duration: 5, resolution: "720p" });
    const seen: string[] = [];
    await executeVideoSubmission(snapshot, null, async (_file, side) => {
      seen.push(side);
      return { key: `${side}-key` };
    }, async (body) => {
      expect(body.leftImage).toBe("left-key");
      expect(body.rightImage).toBe("right-key");
      return { id: "sides-job", status: "queued", progress: 0 };
    }, () => {});
    expect(seen).toEqual(["left", "right"]);
  });

  it("keeps the same files, options, and idempotency key while uploads are pending", async () => {
    const left = { name: "left.jpg" } as File;
    const right = { name: "right.jpg" } as File;
    const options = { aspect: "9:16" as const, duration: 5 as const, resolution: "720p" as const };
    const snapshot = captureVideoSubmission("request-1", "photos-and-options-1", left, right, options);
    let finishLeft!: (value: { key: string }) => void;
    let finishRight!: (value: { key: string }) => void;
    const upload = vi.fn((file: File) => new Promise<{ key: string }>((resolve) => {
      if (file === left) finishLeft = resolve; else finishRight = resolve;
    }));
    const created: GenerationResponse = { id: "job-1", status: "queued", progress: 0 };
    const create = vi.fn(async () => created);
    let cached = null;
    const pending = executeVideoSubmission(snapshot, cached, upload, create, (pair) => { cached = pair; });
    // A later UI edit cannot change this action or its key.
    Object.assign(options, { aspect: "16:9", duration: 15, resolution: "480p" });
    finishLeft({ key: "left-key" });
    finishRight({ key: "right-key" });
    expect(await pending).toEqual(created);
    expect(create).toHaveBeenCalledWith({ leftImage: "left-key", rightImage: "right-key", aspect: "9:16", duration: 5, resolution: "720p", mode: "human" }, "request-1");
    expect(upload.mock.calls.map(([file]) => file)).toEqual([left, right]);
    expect(cached).toEqual({ fingerprint: "photos-and-options-1", leftKey: "left-key", rightKey: "right-key" });
  });

  it("reuses uploaded keys and request identity after an uncertain create failure", async () => {
    const file = { name: "same.jpg" } as File;
    const snapshot = captureVideoSubmission("request-2", "same-input", file, file, { aspect: "9:16", duration: 5, resolution: "720p" });
    const upload = vi.fn(async () => ({ key: "new-key" }));
    const create = vi.fn().mockRejectedValueOnce(new Error("network lost")).mockResolvedValueOnce({ id: "job-2", status: "queued", progress: 0 });
    let cached: { fingerprint: string; leftKey: string; rightKey: string } | null = null;
    await expect(executeVideoSubmission(snapshot, cached, upload, create, (pair) => { cached = pair; })).rejects.toThrow("network lost");
    expect(await executeVideoSubmission(snapshot, cached, upload, create, () => {})).toMatchObject({ id: "job-2" });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][1]).toBe("request-2");
    expect(create.mock.calls[1][1]).toBe("request-2");
    expect(create.mock.calls[0][0]).toEqual(create.mock.calls[1][0]);
  });
});

describe('reference submission', () => {
  const photo = new File(['photo'], 'person.jpg', { type: 'image/jpeg' });
  const video = new File(['video'], 'motion.mp4', { type: 'video/mp4' });
  const audio = new File(['audio'], 'track.wav', { type: 'audio/wav' });
  const options = { aspect: '9:16' as const, duration: 8, resolution: '480p' as const, model: 'wan-3.0' as const, scene: 'hotel-lobby' as const, motion: 'video' as const, soundtrack: 'song' as const, topic: 'ignored' };
  it('captures selected reference files and settings until creation and reuses them after uncertain failure', async () => {
    const references = { video, audio };
    const settings = { ...options };
    const snapshot = captureVideoSubmission('reference-request', 'ref-fingerprint', photo, photo, settings, references);
    settings.scene = 'street-cypher' as typeof settings.scene;
    references.audio = new File(['new'], 'new.wav');
    const referenceUpload = vi.fn(async (_file: File, kind: 'audio' | 'video') => ({ key: `${kind}-key` }));
    const create = vi.fn().mockRejectedValueOnce(new Error('lost')).mockResolvedValueOnce({ id: 'ref-job', status: 'queued', progress: 0 });
    let cached: import('./video-submission').UploadedPair | null = null;
    const photoUpload = vi.fn(async (_file: File, side: string) => ({ key: side }));
    await expect(executeVideoSubmission(snapshot, cached, photoUpload, create, pair => { cached = pair; }, referenceUpload)).rejects.toThrow('lost');
    await executeVideoSubmission(snapshot, cached, photoUpload, create, () => {}, referenceUpload);
    expect(create.mock.calls[0][0]).toMatchObject({ model: 'wan-3.0', scene: 'hotel-lobby', motion: 'video', soundtrack: 'song', referenceVideo: 'video-key', referenceAudio: 'audio-key' });
    expect(referenceUpload.mock.calls.map(([file]) => file)).toEqual([video, audio]);
    expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);
    const changed = captureVideoSubmission('next-request', 'changed-fingerprint', photo, photo, options, { video, audio: references.audio });
    await executeVideoSubmission(changed, cached, photoUpload, create, () => {}, referenceUpload);
    expect(referenceUpload).toHaveBeenCalledTimes(4);
  });
  it('never uploads inactive retained files or sends their keys', async () => {
    const snapshot = captureVideoSubmission('ai-request', 'ai', photo, photo, { ...options, model: 'seedance-2', motion: 'template', soundtrack: 'ai', topic: 'Birthday party' }, { video, audio });
    const referenceUpload = vi.fn();
    let body: unknown;
    await executeVideoSubmission(snapshot, null, async () => ({ key: 'photo' }), async request => { body = request; return { id: 'ai', status: 'queued', progress: 0 }; }, () => {}, referenceUpload);
    expect(referenceUpload).not.toHaveBeenCalled();
    expect(body).toMatchObject({ topic: 'Birthday party', motion: 'template', soundtrack: 'ai' });
    expect(body).not.toHaveProperty('referenceVideo');
    expect(body).not.toHaveProperty('referenceAudio');
  });
  it('fails before creating when selected references are absent', async () => {
    const snapshot = captureVideoSubmission('missing', 'missing', photo, photo, options);
    const create = vi.fn();
    await expect(executeVideoSubmission(snapshot, null, async () => ({ key: 'photo' }), create, () => {}, vi.fn())).rejects.toThrow('reference');
    expect(create).not.toHaveBeenCalled();
  });
});
