const ACCOUNT_HOME = "/app/video-generator";

export function safeAuthReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return ACCOUNT_HOME;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\x00-\x20]/.test(decoded) || decoded.startsWith("//")) return ACCOUNT_HOME;
    const url = new URL(value, "https://migosai.design");
    if (url.origin !== "https://migosai.design" || ["/sign-in", "/sign-up"].includes(url.pathname)) return ACCOUNT_HOME;
    return url.pathname + url.search + url.hash;
  } catch {
    return ACCOUNT_HOME;
  }
}

export function authReturnTo(location: Pick<Location, "pathname" | "search">): string {
  if (location.pathname !== "/sign-in" && location.pathname !== "/sign-up") return `${location.pathname}${location.search}`;
  return safeAuthReturnTo(new URLSearchParams(location.search).get("returnTo"));
}
