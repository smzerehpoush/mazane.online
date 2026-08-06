/**
 * مرز تست وب (قراردادها، بخش «مرزهای تست»): استور seed شده ⟸ خروجی رندرشده.
 *
 * محیط `node` است و هیچ سرویس زنده‌ای لازم نیست: تست‌ها با
 * `setPriceSource` / `setBlogSource` / `setHistorySource` فیک درون‌حافظه‌ای
 * تزریق می‌کنند، پس `ioredis` و `pg` اصلاً load نمی‌شوند.
 *
 * ⚠️ پیکربندی عمداً پلاگین‌های TanStack Start را برنمی‌دارد: تست‌ها به
 * توابع خالص و رندر React سرور می‌زنند، نه به روتر.
 */
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
