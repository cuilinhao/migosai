const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const ENDPOINT = "/api/auth/google/one-tap";
const SESSION_KEY = "migos.google-one-tap.attempted";
const TIMEOUT_MS = 10_000;
const CONNECTION_ERROR = "We could not connect. Please try again.";
const SIGN_IN_ERROR = "Something went wrong. Please try again.";

export type GoogleIdentity = {
  initialize: (options: {
    client_id: string;
    nonce: string;
    auto_select: false;
    cancel_on_tap_outside: true;
    callback: (response: { credential?: string }) => void;
  }) => void;
  prompt: () => void;
  cancel: () => void;
  disableAutoSelect: () => void;
};

export type OneTapCallbacks = {
  onSuccess: () => Promise<void> | void;
  onError?: (message: string) => void;
};

let scriptPromise: Promise<GoogleIdentity> | undefined;
let scriptAttempts = 0;
let configPromise: Promise<{ clientId: string; nonce: string }> | undefined;
let configCreatedAt = 0;
let setupFailures = 0;
let attempted = false;
let signedOut = false;
let activeStop: (() => void) | undefined;

function identity(): GoogleIdentity | undefined {
  return (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
}

function alreadyAttempted() {
  try { return attempted || window.sessionStorage.getItem(SESSION_KEY) === "1"; }
  catch { return attempted; }
}

function rememberAttempt() {
  attempted = true;
  try { window.sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* Storage can be disabled. */ }
}

function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const loaded = identity();
  if (loaded) return Promise.resolve(loaded);
  if (scriptPromise) return scriptPromise;
  if (scriptAttempts >= 2) return Promise.reject(new Error("Google sign-in is unavailable."));
  scriptAttempts += 1;
  scriptPromise = new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT}"]`);
    const script = existing ?? document.createElement("script");
    const finish = (error?: Error) => {
      clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      const api = identity();
      if (error || !api) {
        script.remove();
        reject(error ?? new Error("Google sign-in is unavailable."));
      } else {
        if (signedOut) {
          try { api.disableAutoSelect(); } catch { /* Sign-out still suppresses local prompts. */ }
        }
        resolve(api);
      }
    };
    const onLoad = () => finish();
    const onError = () => finish(new Error("Google sign-in is unavailable."));
    const timer = setTimeout(onError, TIMEOUT_MS);
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (!existing) {
      script.src = GIS_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    scriptPromise = undefined;
    throw error;
  });
  return scriptPromise;
}

async function requestJson(options: RequestInit = {}): Promise<Record<string, unknown>> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        ...options,
        credentials: "same-origin",
        cache: "no-store",
        signal: options.signal ? AbortSignal.any([timeout.signal, options.signal]) : timeout.signal,
      });
    } catch {
      throw new Error(CONNECTION_ERROR);
    }
    let data: unknown;
    try { data = await response.json(); }
    catch (error) {
      const interrupted = timeout.signal.aborted || options.signal?.aborted || (error instanceof Error && error.name === "AbortError");
      throw new Error(interrupted ? CONNECTION_ERROR : SIGN_IN_ERROR);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(SIGN_IN_ERROR);
    const body = data as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : SIGN_IN_ERROR);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function getConfig() {
  // Sharing this request prevents effect restarts from racing to replace the nonce cookie.
  if (configPromise && Date.now() - configCreatedAt < 60_000) return configPromise;
  configCreatedAt = Date.now();
  configPromise = requestJson().then((data) => {
    if (typeof data.clientId !== "string" || !data.clientId || typeof data.nonce !== "string" || !data.nonce) {
      throw new Error("Google sign-in is unavailable.");
    }
    return { clientId: data.clientId, nonce: data.nonce };
  }).catch((error: unknown) => {
    configPromise = undefined;
    throw error;
  });
  return configPromise;
}

/** Start one passive sign-in attempt; the returned cleanup owns all callbacks and UI. */
export function startGoogleOneTap({ onSuccess, onError }: OneTapCallbacks): () => void {
  if (typeof window === "undefined" || alreadyAttempted() || activeStop || setupFailures >= 2) return () => {};
  let active = true;
  let prompted = false;
  let submitted = false;
  let api: GoogleIdentity | undefined;
  let visibilityListener: (() => void) | undefined;
  const credentialRequest = new AbortController();

  const stop = () => {
    if (!active) return;
    active = false;
    credentialRequest.abort();
    if (visibilityListener) document.removeEventListener("visibilitychange", visibilityListener);
    if (prompted) {
      try { api?.cancel(); } catch { /* GIS can be unavailable after browser navigation. */ }
    }
    if (activeStop === stop) activeStop = undefined;
  };
  activeStop = stop;

  const exchangeCredential = async (credential?: string) => {
    if (!active || submitted || !credential) return;
    submitted = true;
    try {
      const data = await requestJson({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
        signal: credentialRequest.signal,
      });
      if (data.ok !== true) throw new Error(SIGN_IN_ERROR);
      if (active) await onSuccess();
    } catch (error) {
      if (active) onError?.(error instanceof Error ? error.message : SIGN_IN_ERROR);
    }
  };

  const prepare = async () => {
    try {
      const isHidden = () => document.visibilityState === "hidden";
      if (isHidden()) {
        visibilityListener = () => {
          if (document.visibilityState === "hidden") return;
          document.removeEventListener("visibilitychange", visibilityListener!);
          visibilityListener = undefined;
          if (active) void prepare();
        };
        document.addEventListener("visibilitychange", visibilityListener);
        return;
      }
      try { api = await loadGoogleIdentity(); }
      catch {
        if (!active) return;
        api = await loadGoogleIdentity();
      }
      if (!active || alreadyAttempted()) return;
      const config = await getConfig();
      if (!active || alreadyAttempted()) return;
      // A tab may become hidden while the script or nonce request is loading.
      if (isHidden()) { void prepare(); return; }
      api.initialize({
        client_id: config.clientId,
        nonce: config.nonce,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: ({ credential }) => { void exchangeCredential(credential); },
      });
      rememberAttempt();
      prompted = true;
      // Browser suppression and dismissals are normal; never force a second prompt.
      api.prompt();
    } catch {
      setupFailures += 1;
      // Passive sign-in must not interrupt the normal Google/email sign-in controls.
    }
  };
  void prepare();
  return stop;
}

/** Called after explicit sign-out, including when GIS has not finished downloading. */
export function disableGoogleOneTap() {
  if (typeof window === "undefined") return;
  signedOut = true;
  rememberAttempt();
  activeStop?.();
  try { identity()?.disableAutoSelect(); } catch { /* The session suppression still applies. */ }
}
