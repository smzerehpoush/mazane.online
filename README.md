# تابلو (tablo.gold)

تابلوی مقایسه‌ی قیمت طلای ۱۸ عیار در پلتفرم‌های آنلاین ایرانی. یک گردآورنده (collector) هر ۳۰ ثانیه از ۱۴ سکو قیمت می‌گیرد، در ردیس و پستگرس ذخیره می‌کند، و یک اپ وب (web) همان داده را روی یک تابلوی زنده و صفحات هر سکو/دارایی رندر می‌کند. هیچ محاسبه‌ی قیمتی در لایه‌ی وب انجام نمی‌شود — وب فقط می‌خواند و نمایش می‌دهد. قطع هر منبع داده «کهنگی» است، نه خطا: صفحه‌ها همچنان ۲۰۰ برمی‌گردانند.

## معماری در یک نگاه

```mermaid
flowchart RL
    subgraph platforms["۱۴ سکوی طلافروشی"]
        P[wallgold, talasea, milli, …]
    end
    subgraph collector["collector (Python/asyncio)"]
        direction TB
        C1["platform_loop ۳۰ثانیه / reference_loop ۱۲۰ثانیه"]
        C2["retention_loop ۳۶۰۰ثانیه / content_loop ۹۰۰ثانیه"]
        C3["settings_sync_loop ۲۰ثانیه"]
    end
    Redis[(Redis — قیمت جاری)]
    PG[(Postgres — تاریخچه، بلاگ، تنظیمات)]
    subgraph web["web (TanStack Start / Nitro node-server)"]
        W1["لایه‌ی داده src/lib/server"]
        W2["/api/prices، صفحات SSR، پنل ادمین"]
    end
    Browser[مرورگر کاربر]

    P -- HTTP/WS --> collector
    collector -- save_* --> Redis
    collector -- save_* --> PG
    Redis -- get_* --> W1
    PG -- SQL --> W1
    W1 --> W2 --> Browser
```

## پیش‌نیازها

| ابزار | نسخه |
| --- | --- |
| Python | ≥ 3.12 |
| Node.js | 22 |
| Docker + Docker Compose | برای Postgres و Redis محلی |

## اجرای محلی گام‌به‌گام

**۱) سرویس‌های زیرساخت (Postgres + Redis):**

```sh
docker compose -f docker-compose.dev.yml up -d
```

مهاجرت‌های `collector/migrations/*.sql` در اولین بوت پستگرس خودکار اجرا می‌شوند. کاربر/رمز/دیتابیس پیش‌فرض هر سه `mazane` است (نام قدیمی مخزن، عمداً همین مانده).

**۲) گردآورنده (collector):**

```sh
cd collector
python3 -m venv .venv-local   # collector/.venv موجود کهنه است، از آن استفاده نکنید
source .venv-local/bin/activate
pip install -e ".[dev]"
tablo-collector
```

بدون متغیر محیطی اضافه هم بالا می‌آید: پیش‌فرض‌های کد (`redis://127.0.0.1:6379/0` و `postgresql://mazane:mazane@127.0.0.1:5432/mazane`) دقیقاً با `docker-compose.dev.yml` می‌خوانند.

**۳) وب (web):**

```sh
cd web
npm install
npm run dev
```

برای اجرای خروجی build شده: `npm run build && npm start` (که `node .output/server/index.mjs` را اجرا می‌کند).

## تست و تایپ‌چک

| لایه | دستور | وضعیت پایه |
| --- | --- | --- |
| collector | `cd collector && pytest` سپس `mypy src tests` | ۱۸۷ تست سبز، mypy تمیز |
| web | `cd web && npm test` (`vitest run`) | ۵۳۴ تست سبز در ۳۲ suite؛ دقیقاً یک suite (`tokens-sync.test.ts`) از قبل شکسته چون `docs/tokens.css` در working tree نیست |
| web | `cd web && npm run typecheck` (`tsc --noEmit`) | — |

CI (`.github/workflows/ci.yml`) همین دو مسیر را روی هر push/PR اجرا می‌کند (جاب‌های `collector` و `web`)، به‌علاوه‌ی جاب سوم `images` که فقط روی push به `main` ایمیج‌های Docker را می‌سازد و یک smoke test (`GET /` باید ۲۰۰ بدهد، بدون Redis/Postgres زنده) اجرا می‌کند.

## ساختار پوشه‌ها

```
collector/
  src/tablo_collector/
    adapters/       ۱۴ آداپتور سکو (هر کدام یک فایل)
    content/        صف/مولد/انتشار محتوای بلاگ
    references/     منبع مرجع قیمت (talair)
    store/          Redis / Postgres / In-memory (پروتکل Store)
    main.py         هفت کوروتین حلقه‌ی اصلی
    platforms.py    رجیستری ۱۴ سکو
    models.py       مدل‌های Pydantic (frozen)
  migrations/       ۱۲ فایل SQL (001 تا 017، با جهش شماره)
  tests/            ۲۷ فایل تست + fixtures

web/
  src/
    routes/         مسیرهای فایل‌محور TanStack Router (عمومی + /admin + /api)
    lib/            منطق دامنه؛ lib/server/ فقط از سمت سرور import می‌شود
    components/     tablo/ (صفحه‌ی اصلی)، content/ (صفحات سکو/بلاگ)، ui/ (shadcn)
  tests/            ۳۲ suite

ops/                RUNBOOK، healthcheck، پیکربندی Caddy، اسکریپت تأیید گوگل‌بات
.github/workflows/  CI
compose.prod.yml, Dockerfile.web, Dockerfile.collector, deploy.sh   استقرار تولید
```

## مستندات بیشتر

| سند | موضوع |
| --- | --- |
| [docs/01-overview.md](docs/01-overview.md) | نمای کلی محصول و معماری |
| [docs/02-design-components.md](docs/02-design-components.md) | کامپوننت‌های دیزاین و سیستم توکن وب |
| [docs/03-tech-debt.md](docs/03-tech-debt.md) | بدهی فنی شاهدمحور، اولویت‌بندی‌شده |
| [docs/04-domain.md](docs/04-domain.md) | مدل دامنه (سکو، دارایی، کارمزد، …) |
| [ops/RUNBOOK.md](ops/RUNBOOK.md) | استقرار تولید، DNS/CDN، رول‌بک |
| [CLAUDE.md](CLAUDE.md) | راهنمای کار روی این مخزن با Claude Code |

---

## English summary

**Tablo** (tablo.gold) is a Persian gold-price comparison board for the Iranian online gold market. A Python/asyncio **collector** polls 14 online gold-trading platforms every 30 seconds — 13 of them publicly listed (12 OTC-style platforms plus one order-book platform, `daric`) and one (`goldika`) still pending publication permission; two platforms, `daric` and `invi`, stream over persistent WebSockets — normalizes prices into a single `PRICE` side per platform, and writes to **Redis** (current price, TTL-based) and **Postgres** (full history, blog posts, platform settings). A **TanStack Start** web app (React 19, Nitro `node-server` preset) reads that data — never computes prices itself — and renders the live dashboard, per-platform/per-asset pages, a blog, and an admin panel.

Local dev: `docker compose -f docker-compose.dev.yml up -d` for Postgres + Redis, then `cd collector && pip install -e ".[dev]" && tablo-collector`, and `cd web && npm install && npm run dev`. Tests: `pytest` + `mypy src tests` in `collector/` (187 tests, clean mypy); `npm test` + `npm run typecheck` in `web/` (534 tests across 32 suites, one pre-existing failing suite due to a missing `docs/tokens.css`). Data-source outages degrade to staleness (HTTP 200 with a "last updated" timestamp), never a hard error — this is a deliberate design rule enforced by tests.

See `docs/` for the architecture overview, design components, domain model, and known tech debt; `ops/RUNBOOK.md` for production deployment.
