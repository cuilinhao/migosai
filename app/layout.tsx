import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { getMessages } from "@/lib/i18n";
import { getLocale, localizeMetadata } from "@/lib/i18n/server";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/anton/400.css";
import "@fontsource/archivo-black/400.css";
import "./globals.css";
import "./interactive.css";
import "./auth.css";
import "./site-theme.css";
import { AuthProvider } from "@/components/auth-provider";
import { SiteShell } from "@/components/site-shell";
import { GoogleAnalytics } from "@/components/google-analytics";
import { CAMPAIGN_BAR_COOKIE, getCampaignBar } from "@/content/home-discovery";

const baseMetadata: Metadata = {
  metadataBase: new URL("https://migosai.design"),
  title: { default: "MigosAI — AI Images, Videos & Music", template: "%s | MigosAI" },
  description: "Create AI images, videos and music with MigosAI.",
};

export async function generateMetadata(): Promise<Metadata> { return localizeMetadata(baseMetadata); }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  // Evaluated per request on the server, so the homepage campaign bar is in the first HTML (no layout shift).
  const campaignBar = getCampaignBar(Date.now(), readCookie((await cookies()).get(CAMPAIGN_BAR_COOKIE)?.value));
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale} messages={getMessages(locale)}>
        <AuthProvider>
          <SiteShell campaignBar={campaignBar}>{children}</SiteShell>
        </AuthProvider>
        </LocaleProvider>
        <GoogleAnalytics measurementId="G-VYXRHN7S3D" />
      </body>
    </html>
  );
}

function readCookie(value: string | undefined) {
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return null; }
}
