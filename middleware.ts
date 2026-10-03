import { NextRequest, NextResponse } from "next/server";
import { localeFromPath, stripLocale } from "./lib/i18n/routing";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = localeFromPath(pathname);
  const stripped = stripLocale(pathname);
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const destination = request.nextUrl.clone();
    destination.pathname = stripped;
    return NextResponse.redirect(destination, 308);
  }
  const headers = new Headers(request.headers);
  // Derive these exclusively from the public URL, never from client headers/cookies.
  headers.set("x-migos-locale", locale);
  headers.set("x-migos-pathname", stripped);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!api(?:/|$)|_next(?:/|$)|.*\\..*).*)"] };
