# 1. Repository Overview

## 1.1 The product in one paragraph

"Tablo" (tablo.gold) is a gold price comparison board for Iran's OTC market:
a background service (the collector) fetches the 18-karat gold price from 14
trading platforms every 30 seconds, normalizes them, runs a cross-platform
median check over them, and stores them in Redis (for live display)
and Postgres (for history and archive); a web app shows that same data on
the home page, on each platform/asset page, and on an LLM-generated blog,
and links out to platforms for referral revenue via `/go/<slug>`. For domain
terms (Quote, PlatformSnapshot, PlatformTerms, being listed, etc.) see
[docs/04-domain.md](./04-domain.md).

## 1.2 Topology — two services, four containers

The two services built in this repo (`collector` and `web`), together with
two off-the-shelf infrastructure pieces (`postgres:16`, `redis:7`), make up
the four production containers (`compose.prod.yml`). Web sits behind an
external edge (Caddy) and never binds port 80/443 itself; the collector
publishes no port at all and only needs outbound internet access to crawl
the platforms.

```mermaid
flowchart LR
    subgraph Sources["14 platforms + 1 reference (talair)"]
        HTTP["REST APIs"]
        WS["daric + invi WebSocket"]
    end

    subgraph collector_svc["collector service"]
        C["tablo-collector\n(main.run: 5 loops + 2 WS clients)"]
    end

    subgraph web_svc["web service"]
        W["TanStack Start / Nitro\n(node-server)"]
    end

    PG[("postgres\nhistory + content + settings")]
    R[("redis\ncurrent price + listing + chart")]
    Browser["Browser"]
    Admin["Admin panel (/admin)"]

    HTTP --> C
    WS --> C
    C -- save_snapshot/save_platforms/chart_config --> R
    C -- save_snapshot (history) --> PG
    PG -. platform_settings every 20s .-> C
    C -- POST /api/revalidate-blog --> W

    R -- ioredis get --> W
    PG -- pg Pool --> W
    W -- SSR + GET /api/prices --> Browser
    Admin -- posts/platform_settings --> W
    W -- upsert --> PG
```

## 1.3 The collector: loops

`main.run()` runs exactly seven coroutines concurrently with
`asyncio.gather`: five timed loops plus two persistent WebSocket clients.
Every timed loop follows the same pattern: start time via
`time.monotonic()`, body wrapped in `try/except` with `log.exception`, and
finally `sleep(max(0, INTERVAL - elapsed))` — meaning the interval is fixed,
not cumulative.  [collector/src/tablo_collector/main.py:57-61, 108-269]

| Loop | Interval | Responsibility |
|---|---|---|
| `platform_loop` | 30 seconds | `collect_round` over the 14 adapters: fetch, parse, median check (`sanity.median_outliers`), `save_snapshot` for each platform, then `save_platforms` + `save_instruments` |
| `reference_loop` | 120 seconds | `collect_reference_round` over `REFERENCE_SOURCES` (talair only) with `RobotsCheckedTransport` |
| `retention_loop` | 3600 seconds | `retention_pass(history_store)` over Postgres: hourly aggregation, duplicate compaction, pruning of expired raw rows |
| `content_loop` | 900 seconds | `drain_pass`: publishing queued drafts up to the daily cap + calling the web `revalidate_blog` |
| `settings_sync_loop` | 20 seconds | reading `platform_settings`, building `chart_config` and writing it to the store, updating the platform registry with the referral-URL override |

In addition, two persistent WebSocket clients (not timed loops) with
exponential backoff (`ReconnectingFeedClient`, starting at 1 second, capped
at 60 seconds): `daric_feed.run()` and `invi_feed.run()`. Decoded frames sit
in `FeedCache`, and `platform_loop` reads them via `compose_fetch` — for
daric with a REST fallback if the frame goes stale (`FeedStale`, max frame
age 90 seconds), for invi with no REST fallback at all.
[collector/src/tablo_collector/ws.py:19-80, main.py:114-164]

The User-Agent for every HTTP fetch is the string
`TabloBot/0.1 (+https://tablo.gold/about)`, with a 15-second timeout.
[collector/src/tablo_collector/main.py:62-63]

## 1.4 The 14 platforms

The order of the `PLATFORMS` tuple is the same order as the public listing.
Only `goldika` has the `PERMISSION_PENDING` policy (crawled and stored,
never shown publicly, since `is_listed` is solely a function of
`data_policy == ALLOWED`); only `daric` has the `ORDER_BOOK` market model,
the rest stay at the default `OTC`.
[collector/src/tablo_collector/platforms.py:7-127]

| # | slug | Persian name | Data policy | Market model |
|---|---|---|---|---|
| 1 | `wallgold` | وال‌گلد | ALLOWED | OTC |
| 2 | `talasea` | طلاسی | ALLOWED | OTC |
| 3 | `milli` | میلی | ALLOWED | OTC |
| 4 | `technogold` | تکنوگلد | ALLOWED | OTC |
| 5 | `tlyn` | طلاین | ALLOWED | OTC |
| 6 | `ecogold` | اکوگلد | ALLOWED | OTC |
| 7 | `zarafza` | زرافزا | ALLOWED | OTC |
| 8 | `baazar` | بازر | ALLOWED | OTC |
| 9 | `daric` | داریک | ALLOWED | **ORDER_BOOK** |
| 10 | `melligold` | ملی‌گلد | ALLOWED | OTC |
| 11 | `digikala` | دیجی‌کالا | ALLOWED | OTC |
| 12 | `hamrahgold` | همراه‌گلد | ALLOWED | OTC |
| 13 | `invi` | اینوی | ALLOWED | OTC |
| 14 | `goldika` | گلدیکا | **PERMISSION_PENDING** | OTC |

All 14 adapters declare exactly one instrument: `Instrument.GOLD_18K`.
[collector/src/tablo_collector/adapters/*.py]

## 1.5 The Redis contract

Key names are a shared contract with the web layer — changing them silently
breaks web. [collector/src/tablo_collector/store/redis_store.py:1-20]

| Key | TTL | Writer | Reader in web |
|---|---|---|---|
| `tablo:current:{slug}` | 120 seconds (`DEFAULT_PRICE_TTL_SECONDS`) | `RedisStore.save_snapshot` | `price-source.ts` |
| `tablo:updated_at:{slug}` | No TTL (deliberately — staleness is a signal, not an error) | same | `price-source.ts` |
| `tablo:listed` | No TTL | `save_platforms` (only `is_listed` platforms) | `price-source.ts` |
| `tablo:instruments` | No TTL | `save_instruments` | `price-source.ts` |
| `tablo:reference:{slug}` | 900 seconds (`DEFAULT_REFERENCE_TTL_SECONDS`) | `save_reference` | Not read; web's reference rate comes from Postgres (`hourly_rollups`) |
| `tablo:chart_config` | No TTL | `save_chart_config` (from `settings_sync_loop`) | `chart-config-source.ts` |

A suppressed snapshot (`suppressed=True`) is never written to Redis at all —
`RedisStore.save_snapshot` returns early; that same snapshot is inserted
into Postgres with the column `suppressed=true`.
[collector/src/tablo_collector/store/redis_store.py:46-58]

## 1.6 The Postgres schema — final state after 17 migrations

The `collector/migrations` folder has exactly 12 `.sql` files, numbered
001-004 and 010-017 (jumping from 004 to 010). Migration 017 is
irreversible: it removes the BUY/SELL/MEAN sides from `quotes` and
`hourly_rollups`, removes the `bonbast` reference and every reference asset
other than `GOLD_18K_TOMAN`, and renames what remains to the single-valued
`side = 'PRICE'`. [collector/migrations/017_one_price_per_platform.sql]

Eight final tables:

| Table | Columns (type, key constraint) |
|---|---|
| `quotes` | `id` bigserial PK; `platform_slug`, `instrument` text; `side` text (`check = 'PRICE'`); `price_toman`, `raw_value`, `raw_scale` numeric; `fetched_at` timestamptz; `suppressed` boolean not null default false. Index `(platform_slug, fetched_at desc)` |
| `platform_terms` | `id` bigserial PK; `platform_slug` text; `buy_fee_percent`, `sell_fee_percent`, `round_trip_percent` numeric **nullable**; `fee_source` text (`check in ('API','MANUAL','IMPLIED','UNKNOWN')`); `buy_enabled`, `sell_enabled` boolean; `observed_at` timestamptz. Constraint: `UNKNOWN` ⟸ all three fees null, any other value ⟸ all three populated. Index `(platform_slug, observed_at desc)` |
| `platforms` | `slug` text PK; `name_fa` text; `data_policy` text (4 values: ALLOWED/RESTRICTED/PERMISSION_PENDING/BLOCKED); `is_listed` boolean; `market_model` text not null default `'OTC'` (`check in ('OTC','ORDER_BOOK')`) |
| `reference_quotes` | `id` bigserial PK; `reference_slug`, `name_fa`, `source_url` text; `instrument` text (`check = 'GOLD_18K_TOMAN'`); `side` text (`check = 'PRICE'`); `value`, `raw_value`, `raw_scale` numeric; `fetched_at` timestamptz. Index `(reference_slug, fetched_at desc)` |
| `hourly_rollups` | `id` bigserial PK; `kind` text (`check in ('PLATFORM','REFERENCE')`); `source_slug`, `instrument` text; `side` text (`check = 'PRICE'`, kept because it's part of the natural key); `hour_start` timestamptz; `open_value`, `close_value`, `min_value`, `max_value` numeric (`check min<=max`); `sample_count` integer (`check > 0`). Unique `(kind, source_slug, instrument, side, hour_start)`; index `(source_slug, instrument, hour_start desc)` |
| `posts` | `slug` text PK (`check ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`); `title_fa`, `body_md` text; `status` text not null default `'draft'` (3 values: draft/published/retracted); `published_at` timestamptz nullable; `updated_at` timestamptz; `check (status='draft' or published_at is not null)`; `image_url`, `image_alt`, `image_width`, `image_height` (migration 016, all four nullable with a `check` requiring alt when there's an image). Partial index `(published_at desc) where status='published'` |
| `post_views` | `slug` text PK (`references posts(slug) on delete cascade`); `views` bigint not null default 0 (`check >= 0`); `last_seen_at` timestamptz not null default now(). Index `(views desc)` — no personal data whatsoever |
| `platform_settings` | `slug` text PK (`references platforms(slug)`); `in_chart` boolean not null default false; `chart_color` text (`check ~ '^#[0-9a-f]{6}$'`); `chart_order` int; `referral_url` text; `updated_at` timestamptz not null default now() |

## 1.7 Web routes

### Public

| Route | Description |
|---|---|
| `/` | Home page; all data comes from a single server `loader` (`loadHomeData`), no client-side fetch for the first render |
| `/$slug` | Platform or asset page; `resolveSlug` determines which (`SlugPageData` is two-state) |
| `/blog` | List of published posts |
| `/blog/$slug` | A single post's page |
| `/mazane-chist` | Static page, "مظنه چیست" |
| `/darbare-pishnahad` | Static page, "درباره‌ی پیشنهاد سردبیر" |
| `/robots.txt` | Generated in code (`lib/seo/robots.ts`) |
| `/sitemap.xml` | XML; deliberately returns 503 with an empty body on blog-source error |
| `/go/$slug` | Revenue-generating outbound redirect (302) to `referral_url` or, absent that, `website_url`; `noindex` + `no-store` |

### Admin panel (behind `beforeLoad → checkAdminSession`)

| Route | Description |
|---|---|
| `/admin` | Layout |
| `/admin/` | Dashboard |
| `/admin/login` | Login form (the only route exempt from the session gate) |
| `/admin/platforms` | Chart/platform settings |
| `/admin/posts/` | List of posts |
| `/admin/posts/new` | Create a post |
| `/admin/posts/$slug` | Edit a post |

### API

| Route | Methods | Description |
|---|---|---|
| `/api/prices` | GET | Live dashboard payload; always `no-store` |
| `/api/admin-login` | POST | Admin login (locks after 5 failures, for 15 minutes) |
| `/api/admin-logout` | POST | Admin logout |
| `/api/admin-platform-settings` | GET, POST | Read/write chart membership and order |
| `/api/admin-posts` | GET, POST | List/create a post |
| `/api/admin-posts/$slug` | GET, POST | Read/edit a post's text |
| `/api/admin-posts/$slug/publish` | POST | Manual publish |
| `/api/admin-posts/$slug/retract` | POST | Retract |
| `/api/admin-posts/$slug/image` | POST | Upload the featured image (upload only, no delete) |
| `/api/post-view` | POST | Records a view from the browser (after staying on the page for 3 seconds) |
| `/api/revalidate-blog` | POST | Token-gated; the collector calls it after every publish |

Every `routes/api/*` route and `routes/go/$slug.ts` has only
`server.handlers` and no `component` — this is what lets it be pruned from
the client tree, so the `ioredis`/`pg` imports stay safe.

## 1.8 The end-to-end data path: from adapter to browser

| # | Component | File | What it does |
|---|---|---|---|
| 1 | Adapter (14 of them) | `collector/.../adapters/*.py` | Fetches the raw payload (HTTP or `FeedCache` for daric/invi) and `parse`s it into a `PlatformSnapshot` |
| 2 | `collect_round` | `collector/.../pipeline.py:44-77` | Cross-platform median check (`sanity.median_outliers`); an outlier platform becomes `suppressed=True` |
| 3 | `MultiStore.save_snapshot` | `collector/.../store/__init__.py` | Writes concurrently to Redis (`tablo:current:{slug}`, `tablo:updated_at:{slug}`) and Postgres (`quotes`, `platform_terms` — even when suppressed) |
| 4 | `createRedisPriceSource` | `web/.../server/price-source.ts` | Reads with `ioredis`; every method is in a try/catch — a Redis outage means `null`/`[]`, not an error |
| 5 | `fetchRows` / `priceToman` | `web/.../rows.ts` | Combines the snapshot with the list of listed platforms (from `lib/catalog.ts`, which takes precedence over the static registry) |
| 6a | SSR (`loadHomeData` / `content-data.ts`) | `web/.../home-data.ts`, `content-data.ts` | Once per request; ready-made HTML with Persian numerals, readable without needing JS |
| 6b | `GET /api/prices` | `web/.../server/live-prices.ts` | `useLiveDashboard` fetches every 30 seconds (when the tab is visible); `DashboardLive` writes the result directly onto existing DOM nodes, not through React state |

The display-layer "stale" threshold is three minutes
(`STALE_AFTER_MINUTES = 3`), separate from the `tablo:current:{slug}` key's
own 120-second TTL in Redis.

## 1.9 Running locally and environment variables

**Infrastructure** — only for running locally; the tests depend on no live
service:

```bash
docker compose -f docker-compose.dev.yml up -d   # postgres:16 on 5432, redis:7 on 6379
```

On the first boot of an empty volume, the migrations run in lexicographic
order from `collector/migrations` (mounted read-only at
`/docker-entrypoint-initdb.d`).

**Collector:**

```bash
cd collector
pip install -e ".[dev]"
PYTHONPATH=src python -m pytest        # 187 tests
PYTHONPATH=src mypy src tests
PYTHONPATH=src python -m tablo_collector.main   # or: tablo-collector after installing
```

Note: the existing `collector/.venv` is stale (an old build path,
`mazane-*` scripts) — rebuild the environment from scratch for a real run.

**Web:**

```bash
cd web
npm install
npm run dev      # vite dev — host "::", port 8080
npm test         # vitest run — 31 passing test files
```

**Environment variables:**

| Variable | Code default | Read in |
|---|---|---|
| `TABLO_REDIS_URL` | `redis://127.0.0.1:6379/0` | collector `main.py`; web `price-source.ts`, `chart-config-source.ts` |
| `TABLO_DATABASE_URL` | `postgresql://mazane:mazane@127.0.0.1:5432/mazane` | collector (`main.py`, `content/queue.py`, `content/retract.py`, `content/generator.py`); web `blog-source.ts` (`pgPool`) |
| `TABLO_REVALIDATE_URL` | `http://127.0.0.1:3000/api/revalidate-blog` | collector `content/revalidate.py` |
| `TABLO_REVALIDATE_TOKEN` | No default (empty ⟸ collector never revalidates; web always returns 401) | collector `content/revalidate.py`; web `revalidate-blog.ts` |
| `TABLO_DAILY_PUBLISH_CAP` | `2` (invalid value/less than 1 ⟸ falls back to 2 with a warning) | collector `content/publisher.py` |
| `TABLO_ADMIN_PASSWORD_HASH` | No default; its absence means fail-closed (login is always rejected) | web `admin-session.ts` |
| `TABLO_ADMIN_SESSION_SECRET` | No default; its absence means fail-closed (session is always invalid) | web `admin-session.ts` |
| `TABLO_ARVAN_S3_ENDPOINT` | Required (its absence ⟸ error, image upload fails with 502) | web `image-store.ts` |
| `TABLO_ARVAN_S3_REGION` | `default` | web `image-store.ts` |
| `TABLO_ARVAN_S3_BUCKET` | Required | web `image-store.ts` |
| `TABLO_ARVAN_S3_ACCESS_KEY` | Required | web `image-store.ts` |
| `TABLO_ARVAN_S3_SECRET_KEY` | Required | web `image-store.ts` |
| `TABLO_HEALTH_MAX_STALE_MINUTES` | `"15"` | Only `ops/collector-healthcheck.py` (smoke test/Docker HEALTHCHECK, not the application) |

A complete, annotated example lives in `.env.example` (repo root); the real
`.env` is never committed.
