import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Keep this config in JavaScript: Next 15's TypeScript config transpiler sets
// globalThis.AsyncLocalStorage in the CLI process, defeating OpenNext's guard
// and starting competing workerd instances against the same local SQLite files.
initOpenNextCloudflareForDev();

/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
