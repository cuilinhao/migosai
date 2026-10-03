import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    // Archived deployment evidence contains old source copies, not active tests.
    exclude: [...configDefaults.exclude, ".local-evidence/**"],
  },
});
