import type { Metadata } from "next";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { getMessages } from "@/lib/i18n";
import { getLocale, localizeMetadata } from "@/lib/i18n/server";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";
import "./interactive.css";
import { AuthProvider } from "@/components/auth-provider";
import { SiteShell } from "@/components/site-shell";
import { GoogleAnalytics } from "@/components/google-analytics";

const baseMetadata: Metadata = {
  metadataBase: new URL("https://migosai.design"),
  title: { default: "Migos AI | Hotel Lobby AI Video Generator", template: "%s | Migos AI" },
  description: "Create Hotel Lobby–style AI duo videos from two photos with Migos AI.",
};

export async function generateMetadata(): Promise<Metadata> { return localizeMetadata(baseMetadata); }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale} messages={getMessages(locale)}>
        <AuthProvider>
          <SiteShell>{children}</SiteShell>
        </AuthProvider>
        </LocaleProvider>
        <GoogleAnalytics measurementId="G-VYXRHN7S3D" />
      </body>
    </html>
  );
}
