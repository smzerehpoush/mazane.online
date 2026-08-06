# web — لایه‌ی نمایش مظنه آنلاین

اپ TanStack Start (React 19، Vite، Tailwind 4، shadcn/ui، recharts، Nitro با
هدف `node-server`). این لایه فقط **می‌خوانَد و رندر می‌کند**: هیچ فرمول
قیمتی اینجا نیست (قاعده‌ی ۱ در `docs/design/02-implementation-conventions.md`).

## فرمان‌ها

```sh
npm install
npm run dev        # سرور توسعه
npm run build      # خروجی .output (کلاینت + سرور نود)
npm start          # اجرای خروجی build
npm test           # vitest run — مرز وب، بدون سرویس زنده
npm run typecheck  # tsc --noEmit
```

## لایه‌ی داده

```
src/lib/prices.ts    قرارداد + تایپ‌ها + رجیستری منبع قیمت (بدون وابستگی نود)
src/lib/blog.ts      همان برای پست‌ها
src/lib/history.ts   همان برای سری زمانی نمودار
src/lib/server/      پیاده‌سازی‌های واقعی — ردیس و پستگرس
src/lib/home-data.ts تابع سروری صفحه‌ی اصلی (createServerFn)
```

قاعده‌ی سخت باندل: پلاگین import-protection تنکستک هر مسیری با پوشه‌ی
`server/` را از گراف کلاینت **رد** می‌کند. پس:

- منطق سرور (ioredis، pg) ⟸ همیشه زیر `src/lib/server/`.
- تابع سروری‌ای که کامپوننت صدایش می‌زند ⟸ فایل نازک بیرون از `server/`
  با `createServerFn` (الگو: `src/lib/home-data.ts`).
- کامپوننت‌ها **هرگز** مستقیم از `src/lib/server/*` import نکنند.

تزریق برای تست: `setPriceSource` / `setBlogSource` / `setHistorySource`.
تا وقتی فیک تزریق نشده باشد، منبع پیش‌فرض (ردیس/پستگرس) تنبل ساخته می‌شود؛
پس در تست‌ها `ioredis` و `pg` اصلاً load نمی‌شوند.

## متغیرهای محیط

| متغیر | کاربرد |
| --- | --- |
| `MAZANE_REDIS_URL` | قیمت جاری (پیش‌فرض `redis://127.0.0.1:6379/0`) |
| `MAZANE_DATABASE_URL` | بلاگ و تاریخچه‌ی نمودار |
| `MAZANE_REVALIDATE_TOKEN` | بازاعتبارسنجی بلاگ |

قطع هر کدام «کهنگی» است، نه خطا: صفحه ۲۰۰ می‌ماند و «آخرین به‌روزرسانی» را
نشان می‌دهد (قاعده‌ی ۵).

## دفترچه‌ی طراحی مبدأ

شرح طراحی اولیه‌ی صفحه (چیدمان، رنگ خط‌ها، چهار ستون جدول، دو کارت) در
README مخزن مبدأ است: `/Users/mahdiyar/w/golden-price-compass/README.md`.
اجزای طراحی زیر `src/components/mazane/` اند و هنوز داده‌شان از
`src/data/mock.ts` (موقتی) می‌آید.

مسیرهای نکست قبلی (که این اپ جایشان را گرفت) در تاریخچه‌ی گیت‌اند:
`git show 780f91b:web/app/<path>`.
