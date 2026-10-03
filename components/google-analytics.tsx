"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

export function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
  const [isProductionHost, setIsProductionHost] = useState(false);

  useEffect(() => {
    setIsProductionHost(
      window.location.hostname === "migosai.design" ||
      window.location.hostname === "www.migosai.design",
    );
  }, []);

  if (process.env.NODE_ENV !== "production" || !isProductionHost || !measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) {
    return null;
  }

  // Enhanced measurement handles history changes; avoid a second manual page_view.
  return <>
    <Script id="google-analytics-init" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', ${JSON.stringify(measurementId)}, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
    `}</Script>
    <Script
      id="google-analytics-loader"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
    />
  </>;
}
