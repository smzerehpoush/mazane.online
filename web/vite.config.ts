// پیکربندی بیلد وب — مظنه آنلاین (بلیت ۱۱: زیرساخت استقرار)
//
// چرا این فایل دیگر از `@lovable.dev/vite-tanstack-config` استفاده نمی‌کند:
//
//   ۱. آن بسته `defaultPreset: "cloudflare-module"` را در خودش hardcode کرده
//      بود. یعنی اگر روزی کسی گزینه‌ی `nitro` را از این فایل بردارد — یا آن
//      بسته رفتارش را عوض کند — بیلد بی‌صدا خروجی Cloudflare Worker می‌داد
//      (`wrangler.json`) که نه `ioredis` در آن کار می‌کند نه `pg`. مقصد ما
//      داکر روی سرور خودمان است، پس پریست باید صریح و در کنترل ما باشد.
//   ۲. بیلد تولید نباید به بسته‌ای وابسته باشد که چرخه‌ی انتشارش دست ما نیست؛
//      همه‌ی پلاگین‌های واقعی (tanstackStart، nitro، tailwind، react) مستقیم
//      از upstream می‌آیند و همین‌جا دیده می‌شوند.
//   ۳. باقی کارهای آن بسته مخصوص سندباکس لاوابل بود (devtools، پل سرور توسعه،
//      دروازه‌ی HMR، گزارش‌گر خطای توسعه) و برای ما مصرفی ندارد.
//
// آنچه از پیکربندی قبلی عمداً حفظ شده: import-protection (قاعده‌ی سخت باندل —
// هر مسیری با پوشه‌ی `server/` از گراف کلاینت رد می‌شود)، dedupe ری‌اکت و
// react-query، و alias «@».
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      // مسیر ورودی سرور را به src/server.ts می‌برد (لفاف خطای SSR ما).
      server: { entry: "server" },
      // قاعده‌ی سخت باندل: هر import از مسیری که پوشه‌ی `server/` دارد (یا از
      // `server-only`) در گراف کلاینت **بیلد را می‌شکند**. این تنها چیزی است
      // که جلوی نشت `ioredis`/`pg`/رشته‌ی اتصال به باندل مرورگر را می‌گیرد.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    // پریست صریح: خروجی `.output/server/index.mjs` که با `node` اجرا می‌شود و
    // روی `PORT` (پیش‌فرض ۳۰۰۰) گوش می‌دهد — دقیقاً چیزی که Dockerfile.web
    // اجرا می‌کند. هرگز cloudflare.
    nitro({
      preset: "node-server",
      routeRules: {
        // دارایی‌های `/assets/**` هش محتوا دارند و نیترو خودش immutable شان
        // می‌کند. فایل‌های `public/` این هش را ندارند، پس پیش‌فرض فقط ETag
        // می‌گیرند: یعنی هر بازدید یک رفت‌وبرگشت اضافه برای فونت ۱۱۱ کیلوبایتی
        // که رندر متن به آن گره خورده. روی خط ایران این گران است.
        //
        // بی‌خطر بودن `immutable` از نام فایل می‌آید: نسخه‌ی فونت داخل نام است
        // (`vazirmatn-variable-33.0.3.woff2`)، پس ارتقا = نشانی تازه.
        "/fonts/**": {
          headers: { "cache-control": "public, max-age=31536000, immutable" },
        },
      },
    }),
    viteReact(),
  ],
  resolve: {
    // جای پلاگین `vite-tsconfig-paths` — ویت ۸ خودش `paths` تی‌اس‌کانفیگ را
    // می‌خواند. alias صریح زیر هم می‌ماند تا اگر tsconfig جابه‌جا شد نشکند.
    tsconfigPaths: true,
    alias: { "@": srcDir },
    // یک نسخه‌ی ری‌اکت/کوئری در کل گراف — دو نسخه یعنی خطای هوک در SSR.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: {
    host: "::",
    port: 8080,
  },
});
