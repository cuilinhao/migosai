import { notFound, permanentRedirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/routing";
import AccountLayout from "@/app/app/layout";

// Reuse the existing pages while giving translated URLs real App Router routes.
const routes = {
  "/": () => import("@/app/page"),
  "/landing": () => import("@/app/landing/page"),
  "/tools": () => import("@/app/tools/page"),
  "/effects": () => import("@/app/effects/page"),
  "/ai-image-generator": () => import("@/app/ai-image-generator/page"),
  "/ai-video-generator": () => import("@/app/ai-video-generator/page"),
  "/explore": () => import("@/app/explore/page"),
  "/app/assets": () => import("@/app/app/assets/page"),
  "/pricing": () => import("@/app/pricing/page"),
  "/showcases": () => import("@/app/showcases/page"),
  "/ai-rap-song-generator": () => import("@/app/ai-rap-song-generator/page"),
  "/flying-car-ai-video-generator": () => import("@/app/flying-car-ai-video-generator/page"),
  "/flying-car-ai-video-generator/how-to-make-a-tesla-roadster-flying-car-video": () => import("@/app/flying-car-ai-video-generator/how-to-make-a-tesla-roadster-flying-car-video/page"),
  "/flying-car-ai-video-generator/tesla-flying-car-ai-video-trend": () => import("@/app/flying-car-ai-video-generator/tesla-flying-car-ai-video-trend/page"),
  "/ozil-goal-generator": () => import("@/app/ozil-goal-generator/page"),
  "/ozil-goal-generator/ozil-goal-ai-prompt": () => import("@/app/ozil-goal-generator/ozil-goal-ai-prompt/page"),
  "/ozil-goal-generator/ozil-goal-ai-template": () => import("@/app/ozil-goal-generator/ozil-goal-ai-template/page"),
  "/ozil-goal-generator/ozil-goal-trend": () => import("@/app/ozil-goal-generator/ozil-goal-trend/page"),
  "/ozil-goal-generator/ozil-goal-meme": () => import("@/app/ozil-goal-generator/ozil-goal-meme/page"),
  "/ozil-goal-generator/ozil-goal-capcut-template": () => import("@/app/ozil-goal-generator/ozil-goal-capcut-template/page"),
  "/ozil-goal-generator/ai-football-video-from-photo": () => import("@/app/ozil-goal-generator/ai-football-video-from-photo/page"),
  "/privacy-policy": () => import("@/app/privacy-policy/page"),
  "/terms-of-service": () => import("@/app/terms-of-service/page"),
  "/refund-policy": () => import("@/app/refund-policy/page"),
  "/acceptable-use-policy": () => import("@/app/acceptable-use-policy/page"),
  "/contact": () => import("@/app/contact/page"),
  "/hotel-lobby-ai-video-generator": () => import("@/app/hotel-lobby-ai-video-generator/page"),
  "/hotel-lobby-ai-video-generator-free": () => import("@/app/hotel-lobby-ai-video-generator-free/page"),
  "/hotel-lobby-ai-template": () => import("@/app/hotel-lobby-ai-template/page"),
  "/hotel-lobby-ai-filter": () => import("@/app/hotel-lobby-ai-filter/page"),
  "/hotel-lobby-ai-generator": () => import("@/app/hotel-lobby-ai-generator/page"),
  "/blog/best-hotel-lobby-ai-video-generators-2026": () => import("@/app/blog/best-hotel-lobby-ai-video-generators-2026/page"),
  "/blog": () => import("@/app/blog/page"),
  "/blog/what-is-hotel-lobby-ai-video": () => import("@/app/blog/what-is-hotel-lobby-ai-video/page"),
  "/blog/hotel-lobby-ai-trend-song": () => import("@/app/blog/hotel-lobby-ai-trend-song/page"),
  "/blog/hotel-lobby-ai-video-cat-dog": () => import("@/app/blog/hotel-lobby-ai-video-cat-dog/page"),
  "/blog/hotel-lobby-ai-video-problems-fixes": () => import("@/app/blog/hotel-lobby-ai-video-problems-fixes/page"),
  "/sign-in": () => import("@/app/sign-in/page"),
  "/sign-up": () => import("@/app/sign-up/page"),
  "/app/video-generator": () => import("@/app/app/video-generator/page"),
  "/app/my-videos": () => import("@/app/app/my-videos/page"),
  "/app/my-orders": () => import("@/app/app/my-orders/page"),
  "/app/my-credits": () => import("@/app/app/my-credits/page"),
};
type Props = { params: Promise<{ locale: string; path?: string[] }> };
async function resolvePage(params: Props["params"]) {
  const { locale, path = [] } = await params;
  const pathname = `/${path.join("/")}`;
  if (!isLocale(locale)) notFound();
  if (/^\/ozil-goal-generator\/blog(?:\/|$)/.test(pathname)) permanentRedirect(pathname);
  const effect = pathname.match(/^\/effects\/([^/]+)$/);
  if (effect) return { kind: "effect" as const, page: await import("@/app/effects/[slug]/page"), pathname, params: Promise.resolve({ slug: effect[1] }) };
  if (!Object.hasOwn(routes, pathname)) notFound();
  return { kind: "static" as const, page: await routes[pathname as keyof typeof routes](), pathname };
}
export async function generateMetadata({ params }: Props) {
  const resolved = await resolvePage(params);
  return resolved.kind === "effect" ? resolved.page.generateMetadata({ params: resolved.params }) : resolved.page.generateMetadata();
}
export default async function LocalizedPage({ params }: Props) {
  const resolved = await resolvePage(params);
  if (resolved.kind === "effect") {
    const Page = resolved.page.default;
    return <Page params={resolved.params}/>;
  }
  const { page, pathname } = resolved;
  const Page = page.default;
  return pathname.startsWith("/app/") ? <AccountLayout><Page/></AccountLayout> : <Page/>;
}
