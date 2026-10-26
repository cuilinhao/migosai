import { afterEach, describe, expect, it, vi } from "vitest";
import { pollSubscriptionChange } from "./subscription-change-poll";

const pending = () => Response.json({ subscription: { creditsPending: true } });
const settled = () => Response.json({ subscription: { creditsPending: false } });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("subscription change return polling", () => {
  it("refreshes the balance once the server has recorded the latest invoice", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(pending()).mockResolvedValueOnce(settled());
    const refresh = vi.fn(async () => {});
    const result = pollSubscriptionChange({ signal: new AbortController().signal, fetcher, refresh, isCurrent: () => true });
    await vi.advanceTimersByTimeAsync(1999);
    expect(refresh).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe("settled");
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("/api/subscription", expect.objectContaining({ credentials: "same-origin", cache: "no-store", signal: expect.any(AbortSignal) }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("stops after 30 seconds without claiming credits settled", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => pending());
    const refresh = vi.fn(async () => {});
    const result = pollSubscriptionChange({ signal: new AbortController().signal, fetcher, refresh, isCurrent: () => true });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await result).toBe("delayed");
    expect(refresh).not.toHaveBeenCalled();
    const count = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(count);
  });
  it("times out and aborts even when an upstream read never settles", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const refresh = vi.fn(async () => {});
    const result = pollSubscriptionChange({ signal: new AbortController().signal, fetcher, refresh, isCurrent: () => true });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await result).toBe("delayed");
    expect((fetcher.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });
  it.each([() => Response.json({ error: "unavailable" }, { status: 502 }), () => Response.json({ subscription: null }), () => Response.json({ subscription: {} }), () => Response.json({ subscription: { creditsPending: "false" } })])("treats failures or malformed capability responses as unconfirmed", async response => {
    const refresh = vi.fn(async () => {});
    expect(await pollSubscriptionChange({ signal: new AbortController().signal, fetcher: vi.fn().mockResolvedValue(response()), refresh, isCurrent: () => true })).toBe("error");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("cancels polling when the component unmounts while waiting", async () => {
    vi.useFakeTimers();
    const owner = new AbortController(), fetcher = vi.fn<typeof fetch>().mockImplementation(async () => pending()), refresh = vi.fn(async () => {});
    const result = pollSubscriptionChange({ signal: owner.signal, fetcher, refresh, isCurrent: () => true });
    await vi.advanceTimersByTimeAsync(1);
    owner.abort();
    expect(await result).toBe("cancelled");
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });
  it("does not refresh the old account from a late completed read", async () => {
    let resolve!: (response: Response) => void;
    let ownerCurrent = true;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(done => { resolve = done; })), refresh = vi.fn(async () => {});
    const result = pollSubscriptionChange({ signal: new AbortController().signal, fetcher, refresh, isCurrent: () => ownerCurrent });
    ownerCurrent = false;
    resolve(settled());
    expect(await result).toBe("cancelled");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("aborts an in-flight read on cleanup and ignores its late result", async () => {
    const owner = new AbortController();
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(done => { resolve = done; })), refresh = vi.fn(async () => {});
    const result = pollSubscriptionChange({ signal: owner.signal, fetcher, refresh, isCurrent: () => true });
    owner.abort();
    expect(await result).toBe("cancelled");
    expect((fetcher.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
    resolve(settled());
    await Promise.resolve();
    expect(refresh).not.toHaveBeenCalled();
  });
  it("does not claim settlement if refreshing the account fails", async () => {
    const refresh = vi.fn(async () => { throw new Error("Account read failed"); });
    expect(await pollSubscriptionChange({ signal: new AbortController().signal, fetcher: vi.fn().mockResolvedValue(settled()), refresh, isCurrent: () => true })).toBe("error");
  });
  it("waits for the account refresh before reporting a settled return", async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>(done => { finish = done; }));
    let reported = false;
    const result = pollSubscriptionChange({ signal: new AbortController().signal, fetcher: vi.fn().mockResolvedValue(settled()), refresh, isCurrent: () => true }).then(value => { reported = true; return value; });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(reported).toBe(false);
    finish();
    expect(await result).toBe("settled");
  });
});
