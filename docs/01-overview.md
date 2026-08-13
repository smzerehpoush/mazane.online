# ۱. نمای کلی مخزن

## ۱.۱ محصول در یک پاراگراف

«تابلو» (tablo.gold) یک تابلوی مقایسه‌ی قیمت طلا در بازار OTC ایران است: یک
سرویس پس‌زمینه (گردآورنده) هر ۳۰ ثانیه قیمت طلای ۱۸ عیار را از ۱۴ سکوی
معاملاتی می‌گیرد، آن‌ها را نرمال می‌کند، یک چک میانه‌ی تقاطعی روی‌شان می‌زند
و در ردیس (برای نمایش زنده) و پستگرس (برای تاریخچه و آرشیو) ذخیره می‌کند؛ یک
اپ وب همان داده را روی صفحه‌ی اصلی، صفحه‌ی هر سکو/دارایی و یک بلاگ تولیدشده
با LLM نشان می‌دهد و از طریق `/go/<slug>` به سکوها لینک درآمدزا می‌دهد. برای
اصطلاحات دامنه (Quote، PlatformSnapshot، PlatformTerms، فهرست‌شدن و…) به
[docs/04-domain.md](./04-domain.md) مراجعه کنید.

## ۱.۲ توپولوژی — دو سرویس، چهار کانتینر

دو سرویسِ ساخته‌شده در این مخزن (`collector` و `web`) به‌همراه دو زیرساخت
آماده (`postgres:16`، `redis:7`) چهار کانتینر تولید را تشکیل می‌دهند
(`compose.prod.yml`). وب پشت لبه‌ی خارجی (کدی) قرار می‌گیرد و هرگز درگاه
۸۰/۴۴۳ نمی‌گیرد؛ گردآورنده هیچ درگاهی منتشر نمی‌کند و فقط برای کرال سکوها به
اینترنت بیرون نیاز دارد.

```mermaid
flowchart LR
    subgraph Sources["۱۴ سکو + ۱ مرجع (talair)"]
        HTTP["APIهای REST"]
        WS["وب‌سوکت داریک + اینوی"]
    end

    subgraph collector_svc["سرویس collector"]
        C["tablo-collector\n(main.run: ۵ حلقه + ۲ کلاینت WS)"]
    end

    subgraph web_svc["سرویس web"]
        W["TanStack Start / Nitro\n(node-server)"]
    end

    PG[("postgres\nتاریخچه + محتوا + تنظیمات")]
    R[("redis\nقیمت جاری + فهرست + نمودار")]
    Browser["مرورگر"]
    Admin["پنل مدیریت (/admin)"]

    HTTP --> C
    WS --> C
    C -- save_snapshot/save_platforms/chart_config --> R
    C -- save_snapshot (تاریخچه) --> PG
    PG -. platform_settings هر ۲۰s .-> C
    C -- POST /api/revalidate-blog --> W

    R -- ioredis get --> W
    PG -- pg Pool --> W
    W -- SSR + GET /api/prices --> Browser
    Admin -- posts/platform_settings --> W
    W -- upsert --> PG
```

## ۱.۳ گردآورنده: حلقه‌ها

`main.run()` دقیقاً هفت کوروتین را با `asyncio.gather` هم‌زمان اجرا می‌کند:
پنج حلقه‌ی زمان‌دار به‌علاوه‌ی دو کلاینت وب‌سوکت پایدار. هر حلقه‌ی زمان‌دار
همان الگو را دارد: زمان شروع با `time.monotonic()`، بدنه در `try/except` با
`log.exception`، و در پایان `sleep(max(0, INTERVAL - elapsed))` — یعنی بازه
ثابت است، نه انباشتی.  [collector/src/tablo_collector/main.py:57-61, 108-269]

| حلقه | بازه | مسئولیت |
|---|---|---|
| `platform_loop` | ۳۰ ثانیه | `collect_round` روی ۱۴ آداپتور: فچ، parse، چک میانه (`sanity.median_outliers`)، `save_snapshot` برای هر سکو، و در پایان `save_platforms` + `save_instruments` |
| `reference_loop` | ۱۲۰ ثانیه | `collect_reference_round` روی `REFERENCE_SOURCES` (فقط talair) با `RobotsCheckedTransport` |
| `retention_loop` | ۳۶۰۰ ثانیه | `retention_pass(history_store)` روی پستگرس: تجمیع ساعتی، فشرده‌سازی تکرارها، هرس خام منقضی |
| `content_loop` | ۹۰۰ ثانیه | `drain_pass`: انتشار پیش‌نویس‌های نوبتی تا سقف روزانه + فراخوان `revalidate_blog` وب |
| `settings_sync_loop` | ۲۰ ثانیه | خواندن `platform_settings`، ساخت `chart_config` و نوشتنش در استور، به‌روزرسانی رجیستری سکوها با override نشانی معرف |

به‌علاوه دو کلاینت وب‌سوکت پایدار (نه حلقه‌ی زمان‌دار) با پس‌رفت نمایی
(`ReconnectingFeedClient`، شروع ۱ ثانیه، سقف ۶۰ ثانیه): `daric_feed.run()` و
`invi_feed.run()`. فریم‌های رمزگشایی‌شده در `FeedCache` می‌نشینند و
`platform_loop` از طریق `compose_fetch` آن‌ها را می‌خواند — برای داریک با
جایگزین REST در صورت کهنگی فریم (`FeedStale`، سقف سن فریم ۹۰ ثانیه)، برای
اینوی بدون هیچ جایگزین REST.  [collector/src/tablo_collector/ws.py:19-80,
main.py:114-164]

User-Agent همه‌ی فچ‌های HTTP رشته‌ی `TabloBot/0.1 (+https://tablo.gold/about)`
با مهلت ۱۵ ثانیه است.  [collector/src/tablo_collector/main.py:62-63]

## ۱.۴ ۱۴ سکو

ترتیب تاپل `PLATFORMS` همان ترتیب فهرست عمومی است. فقط `goldika` سیاست
`PERMISSION_PENDING` دارد (کرال و ذخیره می‌شود، هرگز عمومی نمایش داده
نمی‌شود چون `is_listed` تنها تابع `data_policy == ALLOWED` است)؛ فقط `daric`
مدل بازار `ORDER_BOOK` دارد، بقیه پیش‌فرض `OTC` می‌مانند.
[collector/src/tablo_collector/platforms.py:7-127]

| # | slug | نام فارسی | سیاست داده | مدل بازار |
|---|---|---|---|---|
| ۱ | `wallgold` | وال‌گلد | ALLOWED | OTC |
| ۲ | `talasea` | طلاسی | ALLOWED | OTC |
| ۳ | `milli` | میلی | ALLOWED | OTC |
| ۴ | `technogold` | تکنوگلد | ALLOWED | OTC |
| ۵ | `tlyn` | طلاین | ALLOWED | OTC |
| ۶ | `ecogold` | اکوگلد | ALLOWED | OTC |
| ۷ | `zarafza` | زرافزا | ALLOWED | OTC |
| ۸ | `baazar` | بازر | ALLOWED | OTC |
| ۹ | `daric` | داریک | ALLOWED | **ORDER_BOOK** |
| ۱۰ | `melligold` | ملی‌گلد | ALLOWED | OTC |
| ۱۱ | `digikala` | دیجی‌کالا | ALLOWED | OTC |
| ۱۲ | `hamrahgold` | همراه‌گلد | ALLOWED | OTC |
| ۱۳ | `invi` | اینوی | ALLOWED | OTC |
| ۱۴ | `goldika` | گلدیکا | **PERMISSION_PENDING** | OTC |

هر ۱۴ آداپتور دقیقاً یک دارایی اعلام می‌کنند: `Instrument.GOLD_18K`.
[collector/src/tablo_collector/adapters/*.py]

## ۱.۵ قرارداد ردیس

نام کلیدها قرارداد مشترک با لایه‌ی وب است — تغییرشان بی‌صدا وب را می‌شکند.
[collector/src/tablo_collector/store/redis_store.py:1-20]

| کلید | TTL | نویسنده | خواننده در وب |
|---|---|---|---|
| `tablo:current:{slug}` | ۱۲۰ ثانیه (`DEFAULT_PRICE_TTL_SECONDS`) | `RedisStore.save_snapshot` | `price-source.ts` |
| `tablo:updated_at:{slug}` | بدون TTL (عمداً — کهنگی سیگنال است، نه خطا) | همان | `price-source.ts` |
| `tablo:listed` | بدون TTL | `save_platforms` (فقط سکوهای `is_listed`) | `price-source.ts` |
| `tablo:instruments` | بدون TTL | `save_instruments` | `price-source.ts` |
| `tablo:reference:{slug}` | ۹۰۰ ثانیه (`DEFAULT_REFERENCE_TTL_SECONDS`) | `save_reference` | خوانده نمی‌شود؛ نرخ مرجع وب از پستگرس (`hourly_rollups`) می‌آید |
| `tablo:chart_config` | بدون TTL | `save_chart_config` (از `settings_sync_loop`) | `chart-config-source.ts` |

اسنپ‌شات سرکوب‌شده (`suppressed=True`) اصلاً در ردیس نوشته نمی‌شود —
`RedisStore.save_snapshot` زودهنگام برمی‌گردد؛ همان اسنپ‌شات در پستگرس با
ستون `suppressed=true` درج می‌شود.
[collector/src/tablo_collector/store/redis_store.py:46-58]

## ۱.۶ شمای پستگرس — وضعیت نهایی بعد از ۱۷ مهاجرت

پوشه‌ی `collector/migrations` دقیقاً ۱۲ فایل `.sql` دارد با شماره‌های ۰۰۱ تا
۰۰۴ و ۰۱۰ تا ۰۱۷ (جهش ۰۰۴ ← ۰۱۰). مهاجرت ۰۱۷ برگشت‌ناپذیر است: سمت‌های
BUY/SELL/MEAN را از `quotes` و `hourly_rollups` حذف می‌کند، مرجع `bonbast` و
هر دارایی مرجع غیر از `GOLD_18K_TOMAN` را حذف می‌کند، و باقی‌مانده را به
`side = 'PRICE'` تک‌مقداری تغییر نام می‌دهد.
[collector/migrations/017_one_price_per_platform.sql]

هشت جدول نهایی:

| جدول | ستون‌ها (نوع، قید مهم) |
|---|---|
| `quotes` | `id` bigserial PK؛ `platform_slug`, `instrument` text؛ `side` text (`check = 'PRICE'`)؛ `price_toman`, `raw_value`, `raw_scale` numeric؛ `fetched_at` timestamptz؛ `suppressed` boolean not null default false. ایندکس `(platform_slug, fetched_at desc)` |
| `platform_terms` | `id` bigserial PK؛ `platform_slug` text؛ `buy_fee_percent`, `sell_fee_percent`, `round_trip_percent` numeric **nullable**؛ `fee_source` text (`check in ('API','MANUAL','IMPLIED','UNKNOWN')`)؛ `buy_enabled`, `sell_enabled` boolean؛ `observed_at` timestamptz. قید: `UNKNOWN` ⟸ هر سه کارمزد null، هر مقدار دیگر ⟸ هر سه پر. ایندکس `(platform_slug, observed_at desc)` |
| `platforms` | `slug` text PK؛ `name_fa` text؛ `data_policy` text (۴ مقدار: ALLOWED/RESTRICTED/PERMISSION_PENDING/BLOCKED)؛ `is_listed` boolean؛ `market_model` text not null default `'OTC'` (`check in ('OTC','ORDER_BOOK')`) |
| `reference_quotes` | `id` bigserial PK؛ `reference_slug`, `name_fa`, `source_url` text؛ `instrument` text (`check = 'GOLD_18K_TOMAN'`)؛ `side` text (`check = 'PRICE'`)؛ `value`, `raw_value`, `raw_scale` numeric؛ `fetched_at` timestamptz. ایندکس `(reference_slug, fetched_at desc)` |
| `hourly_rollups` | `id` bigserial PK؛ `kind` text (`check in ('PLATFORM','REFERENCE')`)؛ `source_slug`, `instrument` text؛ `side` text (`check = 'PRICE'`، نگه‌داشته‌شده چون جزو کلید طبیعی است)؛ `hour_start` timestamptz؛ `open_value`, `close_value`, `min_value`, `max_value` numeric (`check min<=max`)؛ `sample_count` integer (`check > 0`). یکتای `(kind, source_slug, instrument, side, hour_start)`؛ ایندکس `(source_slug, instrument, hour_start desc)` |
| `posts` | `slug` text PK (`check ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)؛ `title_fa`, `body_md` text؛ `status` text not null default `'draft'` (۳ مقدار: draft/published/retracted)؛ `published_at` timestamptz nullable؛ `updated_at` timestamptz؛ `check (status='draft' or published_at is not null)`؛ `image_url`, `image_alt`, `image_width`, `image_height` (مهاجرت ۰۱۶، هر چهار nullable با `check` اجباری‌بودن alt وقتی عکس هست). ایندکس جزئی `(published_at desc) where status='published'` |
| `post_views` | `slug` text PK (`references posts(slug) on delete cascade`)؛ `views` bigint not null default 0 (`check >= 0`)؛ `last_seen_at` timestamptz not null default now(). ایندکس `(views desc)` — بدون هیچ داده‌ی شخصی |
| `platform_settings` | `slug` text PK (`references platforms(slug)`)؛ `in_chart` boolean not null default false؛ `chart_color` text (`check ~ '^#[0-9a-f]{6}$'`)؛ `chart_order` int؛ `referral_url` text؛ `updated_at` timestamptz not null default now() |

## ۱.۷ مسیرهای وب

### عمومی

| مسیر | توضیح |
|---|---|
| `/` | صفحه‌ی اصلی؛ همه‌ی داده از یک `loader` سروری (`loadHomeData`)، بدون فچ کلاینتی برای رندر اول |
| `/$slug` | صفحه‌ی سکو یا دارایی؛ `resolveSlug` تعیین می‌کند کدام (`SlugPageData` دوحالته) |
| `/blog` | فهرست پست‌های منتشرشده |
| `/blog/$slug` | صفحه‌ی یک پست |
| `/mazane-chist` | صفحه‌ی ایستا «مظنه چیست» |
| `/darbare-pishnahad` | صفحه‌ی ایستا «درباره‌ی پیشنهاد سردبیر» |
| `/robots.txt` | ساخته‌شده در کد (`lib/seo/robots.ts`) |
| `/sitemap.xml` | XML؛ در خطای منبع بلاگ عمداً ۵۰۳ با بدنه‌ی خالی |
| `/go/$slug` | ریدایرکت خروجی درآمدزا (۳۰۲) به `referral_url` یا در نبودش `website_url`؛ `noindex` + `no-store` |

### پنل مدیریت (پشت `beforeLoad → checkAdminSession`)

| مسیر | توضیح |
|---|---|
| `/admin` | لایوت |
| `/admin/` | داشبورد |
| `/admin/login` | فرم ورود (تنها مسیر مستثنا از گیت نشست) |
| `/admin/platforms` | تنظیمات نمودار/سکو |
| `/admin/posts/` | فهرست پست‌ها |
| `/admin/posts/new` | ساخت پست |
| `/admin/posts/$slug` | ویرایش پست |

### API

| مسیر | متدها | توضیح |
|---|---|---|
| `/api/prices` | GET | payload زنده‌ی داشبورد؛ همیشه `no-store` |
| `/api/admin-login` | POST | ورود پنل (قفل پس از ۵ شکست، ۱۵ دقیقه) |
| `/api/admin-logout` | POST | خروج پنل |
| `/api/admin-platform-settings` | GET, POST | خواندن/نوشتن عضویت و ترتیب نمودار |
| `/api/admin-posts` | GET, POST | فهرست/ساخت پست |
| `/api/admin-posts/$slug` | GET, POST | خواندن/ویرایش متن پست |
| `/api/admin-posts/$slug/publish` | POST | انتشار دستی |
| `/api/admin-posts/$slug/retract` | POST | پس‌گیری |
| `/api/admin-posts/$slug/image` | POST | آپلود عکس شاخص (فقط آپلود، حذف ندارد) |
| `/api/post-view` | POST | ثبت بازدید از مرورگر (بعد از ۳ ثانیه ماندن روی صفحه) |
| `/api/revalidate-blog` | POST | توکن‌دار؛ گردآورنده پس از هر انتشار صدا می‌زند |

هر مسیر `routes/api/*` و `routes/go/$slug.ts` فقط `server.handlers` دارد و
`component` ندارد — همین باعث می‌شود از درخت کلاینت هرس شود تا واردات
`ioredis`/`pg` بی‌خطر بماند.

## ۱.۸ مسیر داده‌ی end-to-end: از آداپتور تا مرورگر

| # | جزء | فایل | کار |
|---|---|---|---|
| ۱ | آداپتور (۱۴ تا) | `collector/.../adapters/*.py` | فچ payload خام (HTTP یا `FeedCache` برای داریک/اینوی) و `parse` به `PlatformSnapshot` |
| ۲ | `collect_round` | `collector/.../pipeline.py:44-77` | چک میانه‌ی تقاطعی (`sanity.median_outliers`)؛ سکوی پرت `suppressed=True` می‌شود |
| ۳ | `MultiStore.save_snapshot` | `collector/.../store/__init__.py` | نوشتن هم‌زمان روی Redis (`tablo:current:{slug}`, `tablo:updated_at:{slug}`) و Postgres (`quotes`, `platform_terms` — حتی سرکوب‌شده) |
| ۴ | `createRedisPriceSource` | `web/.../server/price-source.ts` | خواندن با `ioredis`؛ هر متد در try/catch — قطع ردیس یعنی `null`/`[]`، نه خطا |
| ۵ | `fetchRows` / `priceToman` | `web/.../rows.ts` | ترکیب snapshot با فهرست سکوهای listed (از `lib/catalog.ts`، مقدم بر رجیستری ایستا) |
| ۶-الف | SSR (`loadHomeData` / `content-data.ts`) | `web/.../home-data.ts`, `content-data.ts` | یک‌بار در هر درخواست؛ HTML آماده با اعداد فارسی، بدون نیاز به JS برای خوانا بودن |
| ۶-ب | `GET /api/prices` | `web/.../server/live-prices.ts` | `useLiveDashboard` هر ۳۰ ثانیه فچ می‌کند (وقتی تب پیداست)؛ `DashboardLive` نتیجه را مستقیم روی گره‌های DOM موجود می‌نشاند، نه با state ری‌اکت |

آستانه‌ی «کهنه» در نمایش سه دقیقه است (`STALE_AFTER_MINUTES = 3`)، جدا از
TTL ۱۲۰ثانیه‌ای خودِ کلید `tablo:current:{slug}` در ردیس.

## ۱.۹ اجرای محلی و متغیرهای محیطی

**زیرساخت** — فقط برای اجرای محلی؛ تست‌ها به هیچ سرویس زنده‌ای وابسته
نیستند:

```bash
docker compose -f docker-compose.dev.yml up -d   # postgres:16 روی 5432، redis:7 روی 6379
```

مهاجرت‌ها در اولین بوت volume خالی به‌ترتیب واژه‌نگاری از
`collector/migrations` اجرا می‌شوند (mount خواندنی روی
`/docker-entrypoint-initdb.d`).

**گردآورنده:**

```bash
cd collector
pip install -e ".[dev]"
PYTHONPATH=src python -m pytest        # ۱۸۷ تست
PYTHONPATH=src mypy src tests
PYTHONPATH=src python -m tablo_collector.main   # یا: tablo-collector پس از نصب
```

نکته: `collector/.venv` موجود کهنه است (مسیر ساخت قدیمی، اسکریپت‌های
`mazane-*`) — برای اجرای واقعی محیط را از نو بسازید.

**وب:**

```bash
cd web
npm install
npm run dev      # vite dev — host "::", پورت 8080
npm test         # vitest run — از ۳۲ فایل تست، ۳۱ سبز و ۱ (tokens-sync.test.ts) خراب چون docs/tokens.css در working tree نیست
```

**متغیرهای محیطی:**

| متغیر | پیش‌فرض کد | خوانده می‌شود در |
|---|---|---|
| `TABLO_REDIS_URL` | `redis://127.0.0.1:6379/0` | collector `main.py`؛ وب `price-source.ts`, `chart-config-source.ts` |
| `TABLO_DATABASE_URL` | `postgresql://mazane:mazane@127.0.0.1:5432/mazane` | collector (`main.py`, `content/queue.py`, `content/retract.py`, `content/generator.py`)؛ وب `blog-source.ts` (`pgPool`) |
| `TABLO_REVALIDATE_URL` | `http://127.0.0.1:3000/api/revalidate-blog` | collector `content/revalidate.py` |
| `TABLO_REVALIDATE_TOKEN` | بدون پیش‌فرض (خالی ⟸ collector هرگز revalidate نمی‌کند؛ وب همیشه ۴۰۱ می‌دهد) | collector `content/revalidate.py`؛ وب `revalidate-blog.ts` |
| `TABLO_DAILY_PUBLISH_CAP` | `2` (مقدار نامعتبر/کمتر از ۱ ⟸ برگشت به ۲ با هشدار) | collector `content/publisher.py` |
| `TABLO_ADMIN_PASSWORD_HASH` | بدون پیش‌فرض؛ نبودش یعنی fail-closed (ورود همیشه رد) | وب `admin-session.ts` |
| `TABLO_ADMIN_SESSION_SECRET` | بدون پیش‌فرض؛ نبودش یعنی fail-closed (نشست همیشه نامعتبر) | وب `admin-session.ts` |
| `TABLO_ARVAN_S3_ENDPOINT` | اجباری (نبودش ⟸ خطا، آپلود عکس با ۵۰۲ شکست می‌خورد) | وب `image-store.ts` |
| `TABLO_ARVAN_S3_REGION` | `default` | وب `image-store.ts` |
| `TABLO_ARVAN_S3_BUCKET` | اجباری | وب `image-store.ts` |
| `TABLO_ARVAN_S3_ACCESS_KEY` | اجباری | وب `image-store.ts` |
| `TABLO_ARVAN_S3_SECRET_KEY` | اجباری | وب `image-store.ts` |
| `TABLO_HEALTH_MAX_STALE_MINUTES` | `"15"` | فقط `ops/collector-healthcheck.py` (دود-تست/HEALTHCHECK داکر، نه اپلیکیشن) |

نمونه‌ی کامل با توضیح در `.env.example` (ریشه‌ی مخزن) است؛ `.env` واقعی
کامیت نمی‌شود.
