import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;

// Bind the local D1/R2 emulators during next dev.
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
