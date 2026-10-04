import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Client = typeof import("./google-one-tap-client");
type Settings = Parameters<import("./google-one-tap-client").GoogleIdentity["initialize"]>[0];

class Script extends EventTarget {
  src = "";
  async = false;
  defer = false;
  removed = false;
  remove() { this.removed = true; }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("Google One Tap browser lifecycle", () => {
  let client: Client;
  let scripts: Script[];
  let settings: Settings | undefined;
  let prompts: number;
  let cancellations: number;
  let signouts: number;
  let storage: Map<string, string>;
  let browser: { sessionStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }; google?: unknown };
  let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;

  function installGoogle() {
    browser.google = { accounts: { id: {
      initialize: (value: Settings) => { settings = value; },
      prompt: () => { prompts += 1; },
      cancel: () => { cancellations += 1; },
      disableAutoSelect: () => { signouts += 1; },
    } } };
  }

  beforeEach(async () => {
    vi.resetModules();
    scripts = [];
    settings = undefined;
    prompts = 0;
    cancellations = 0;
    signouts = 0;
    storage = new Map();
    browser = { sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => { storage.set(key, value); },
    } };
    fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => Response.json(
      options?.method === "POST" ? { ok: true } : { clientId: "test.apps.googleusercontent.com", nonce: "server-nonce" },
    ));
    vi.stubGlobal("window", browser);
    vi.stubGlobal("document", {
      querySelector: () => scripts.find((script) => !script.removed) ?? null,
      createElement: () => new Script(),
      head: { appendChild: (script: Script) => { scripts.push(script); } },
    });
    vi.stubGlobal("fetch", fetcher);
    client = await import("./google-one-tap-client");
  });

  afterEach(() => {
    client?.disableGoogleOneTap();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shares a pending script across an effect restart and only prompts the live effect", async () => {
    const first = client.startGoogleOneTap({ onSuccess: vi.fn() });
    first();
    const second = client.startGoogleOneTap({ onSuccess: vi.fn() });
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe("https://accounts.google.com/gsi/client");
    installGoogle();
    scripts[0].dispatchEvent(new Event("load"));
    await flush();
    expect(prompts).toBe(1);
    expect(settings).toMatchObject({ client_id: "test.apps.googleusercontent.com", nonce: "server-nonce", auto_select: false });
    expect(fetcher).toHaveBeenCalledWith("/api/auth/google/one-tap", expect.objectContaining({ credentials: "same-origin", cache: "no-store" }));
    second();
  });

  it("exchanges a selected credential once before refreshing the signed-in account", async () => {
    installGoogle();
    const onSuccess = vi.fn();
    client.startGoogleOneTap({ onSuccess });
    await flush();
    settings!.callback({ credential: "signed-google-credential" });
    settings!.callback({ credential: "signed-google-credential" });
    await flush();
    const posts = fetcher.mock.calls.filter(([, options]) => options?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual(["/api/auth/google/one-tap", expect.objectContaining({
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: '{"credential":"signed-google-credential"}',
    })]);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("cancels an active prompt and does not prompt again after re-enabling or reloading the module", async () => {
    installGoogle();
    const stop = client.startGoogleOneTap({ onSuccess: vi.fn() });
    await flush();
    stop();
    expect(cancellations).toBe(1);
    client.startGoogleOneTap({ onSuccess: vi.fn() });
    vi.resetModules();
    client = await import("./google-one-tap-client");
    client.startGoogleOneTap({ onSuccess: vi.fn() });
    await flush();
    expect(prompts).toBe(1);
  });

  it("ignores credentials returned after the effect has been disabled", async () => {
    installGoogle();
    const onSuccess = vi.fn();
    const stop = client.startGoogleOneTap({ onSuccess });
    await flush();
    stop();
    settings!.callback({ credential: "late-credential" });
    await flush();
    expect(fetcher.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shares an unfinished nonce request so effect restarts cannot rotate each other's cookie", async () => {
    installGoogle();
    let finish!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const stop = client.startGoogleOneTap({ onSuccess: vi.fn() });
    await flush();
    stop();
    client.startGoogleOneTap({ onSuccess: vi.fn() });
    await flush();
    expect(fetcher).toHaveBeenCalledOnce();
    finish(Response.json({ clientId: "test.apps.googleusercontent.com", nonce: "shared-nonce" }));
    await flush();
    expect(prompts).toBe(1);
    expect(settings?.nonce).toBe("shared-nonce");
  });

  it("does not initialize after a cancelled nonce request finishes", async () => {
    installGoogle();
    let finish!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const stop = client.startGoogleOneTap({ onSuccess: vi.fn() });
    await flush();
    stop();
    finish(Response.json({ clientId: "test.apps.googleusercontent.com", nonce: "unused-nonce" }));
    await flush();
    expect(settings).toBeUndefined();
    expect(prompts).toBe(0);
  });

  it("silently retries a failed GIS download once, then preserves the ordinary sign-in fallback", async () => {
    const onError = vi.fn();
    const stop = client.startGoogleOneTap({ onSuccess: vi.fn(), onError });
    scripts[0].dispatchEvent(new Event("error"));
    await flush();
    expect(scripts).toHaveLength(2);
    scripts[1].dispatchEvent(new Event("error"));
    await flush();
    stop();
    client.startGoogleOneTap({ onSuccess: vi.fn(), onError });
    await flush();
    expect(scripts).toHaveLength(2);
    expect(fetcher).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("suppresses One Tap on signout even when the GIS script is still loading", async () => {
    client.startGoogleOneTap({ onSuccess: vi.fn() });
    client.disableGoogleOneTap();
    installGoogle();
    scripts[0].dispatchEvent(new Event("load"));
    await flush();
    client.startGoogleOneTap({ onSuccess: vi.fn() });
    await flush();
    expect(signouts).toBe(1);
    expect(prompts).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces only a selected credential rejection and never treats it as a signed-in account", async () => {
    installGoogle();
    const onError = vi.fn();
    const onSuccess = vi.fn();
    fetcher.mockImplementation(async (_url, options) => options?.method === "POST"
      ? Response.json({ error: "Sign-in expired. Please try again." }, { status: 401 })
      : Response.json({ clientId: "test.apps.googleusercontent.com", nonce: "server-nonce" }));
    client.startGoogleOneTap({ onSuccess, onError });
    await flush();
    settings!.callback({ credential: "expired-credential" });
    await flush();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Sign-in expired. Please try again.");
  });

  it("does not notify an unmounted component after an in-flight credential succeeds", async () => {
    installGoogle();
    let finish!: (response: Response) => void;
    const onSuccess = vi.fn();
    fetcher.mockImplementation(async (_url, options) => options?.method === "POST"
      ? new Promise((resolve) => { finish = resolve; })
      : Response.json({ clientId: "test.apps.googleusercontent.com", nonce: "server-nonce" }));
    const stop = client.startGoogleOneTap({ onSuccess });
    await flush();
    settings!.callback({ credential: "credential" });
    await flush();
    stop();
    finish(Response.json({ ok: true }));
    await flush();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("does not prompt with an invalid bootstrap response or raise a passive error", async () => {
    installGoogle();
    const onError = vi.fn();
    fetcher.mockResolvedValue(Response.json({ clientId: "test.apps.googleusercontent.com" }));
    client.startGoogleOneTap({ onSuccess: vi.fn(), onError });
    await flush();
    expect(prompts).toBe(0);
    expect(onError).not.toHaveBeenCalled();
  });

  it.each([
    { name: "a network failure", result: () => Promise.reject(new TypeError("Failed to fetch")), message: "We could not connect. Please try again." },
    { name: "a request timeout", result: () => Promise.reject(new DOMException("The operation was aborted.", "AbortError")), message: "We could not connect. Please try again." },
    { name: "invalid JSON", result: () => Promise.resolve(new Response("<html>Unexpected upstream response</html>")), message: "Something went wrong. Please try again." },
    { name: "a malformed response", result: () => Promise.resolve(Response.json([])), message: "Something went wrong. Please try again." },
    { name: "a missing success result", result: () => Promise.resolve(Response.json({})), message: "Something went wrong. Please try again." },
  ])("shows a user-facing message for $name during credential exchange", async ({ result, message }) => {
    installGoogle();
    const onError = vi.fn();
    const onSuccess = vi.fn();
    fetcher.mockImplementation((_url, options) => options?.method === "POST"
      ? result()
      : Promise.resolve(Response.json({ clientId: "test.apps.googleusercontent.com", nonce: "server-nonce" })));
    client.startGoogleOneTap({ onSuccess, onError });
    await flush();
    settings!.callback({ credential: "selected-credential" });
    await flush();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(message);
  });
});
