import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/routing";
import AccountLayout from "@/app/app/layout";

// Reuse the existing pages while giving translated URLs real App Router routes.
const routes = {
  "/": () => import("@/app/page"),
  "/pricing": () => import("@/app/pricing/page"),
  "/showcases": () => import("@/app/showcases/page"),
  "/ai-rap-song-generator": () => import("@/app/ai-rap-song-generator/page"),
  "/privacy-policy": () => import("@/app/privacy-policy/page"),
  "/terms-of-service": () => import("@/app/terms-of-service/page"),
  "/refund-policy": () => import("@/app/refund-policy/page"),
  "/acceptable-use-policy": () => import("@/app/acceptable-use-policy/page"),
  "/hotel-lobby-ai-video-generator": () => import("@/app/hotel-lobby-ai-video-generator/page"),
  "/hotel-lobby-ai-video-generator-free": () => import("@/app/hotel-lobby-ai-video-generator-free/page"),
  "/hotel-lobby-ai-template": () => import("@/app/hotel-lobby-ai-template/page"),
  "/hotel-lobby-ai-filter": () => import("@/app/hotel-lobby-ai-filter/page"),
  "/hotel-lobby-ai-generator": () => import("@/app/hotel-lobby-ai-generator/page"),
  "/blog/best-hotel-lobby-ai-video-generators-2026": () => import("@/app/blog/best-hotel-lobby-ai-video-generators-2026/page"),
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
  if (!isLocale(locale) || !Object.hasOwn(routes, pathname)) notFound();
  return { page: await routes[pathname as keyof typeof routes](), pathname };
}
export async function generateMetadata({ params }: Props) {
  const { page } = await resolvePage(params);
  return page.generateMetadata();
}
export default async function LocalizedPage({ params }: Props) {
  const { page, pathname } = await resolvePage(params);
  const Page = page.default;
  return pathname.startsWith("/app/") ? <AccountLayout><Page/></AccountLayout> : <Page/>;
}
