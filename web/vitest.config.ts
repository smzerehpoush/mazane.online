import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      // لودر واقعی فقط در بیلد نکست معنا دارد — بدل، فقط className می‌دهد.
      "next/font/google": fileURLToPath(
        new URL("./tests/support/next-font-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
