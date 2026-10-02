import { describe, expect, it, vi } from "vitest";
import type { GenerationResponse } from "@/lib/contracts";
import { captureVideoSubmission, executeVideoSubmission } from "./video-submission";

describe("video submission snapshot", () => {
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
