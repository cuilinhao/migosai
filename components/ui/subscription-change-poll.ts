export type SubscriptionChangePollResult = "settled" | "delayed" | "error" | "cancelled";
type PollOptions = { signal: AbortSignal; refresh: () => Promise<void>; isCurrent: () => boolean; fetcher?: typeof fetch };

/** A return URL is only a request to check state, never evidence of payment. */
export async function pollSubscriptionChange({ signal, refresh, isCurrent, fetcher = fetch }: PollOptions): Promise<SubscriptionChangePollResult> {
  if (signal.aborted || !isCurrent()) return "cancelled";
  const request = new AbortController();
  let timedOut = false;
  const abort = () => request.abort();
  signal.addEventListener("abort", abort, { once: true });
  const cancelled = new Promise<SubscriptionChangePollResult>(resolve => {
    request.signal.addEventListener("abort", () => resolve(timedOut ? "delayed" : "cancelled"), { once: true });
  });
  const deadline = setTimeout(() => { timedOut = true; request.abort(); }, 30_000);
  const active = () => !signal.aborted && !request.signal.aborted && isCurrent();
  const pause = () => new Promise<void>(resolve => {
    if (request.signal.aborted) { resolve(); return; }
    const finish = () => { clearTimeout(timer); request.signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, 2000);
    request.signal.addEventListener("abort", finish, { once: true });
  });
  const run = async (): Promise<SubscriptionChangePollResult> => {
    try {
      while (active()) {
        const response = await fetcher("/api/subscription", { credentials: "same-origin", cache: "no-store", signal: request.signal });
        if (!active()) return "cancelled";
        if (!response.ok) return "error";
        const body = await response.json() as { subscription?: { creditsPending?: unknown } | null } | null;
        if (!active()) return "cancelled";
        if (typeof body?.subscription?.creditsPending !== "boolean") return "error";
        if (!body.subscription.creditsPending) {
          await refresh();
          return active() ? "settled" : "cancelled";
        }
        await pause();
      }
      return "cancelled";
    } catch { return active() ? "error" : "cancelled"; }
  };
  try { return await Promise.race([cancelled, run()]); }
  finally { clearTimeout(deadline); signal.removeEventListener("abort", abort); request.abort(); }
}
