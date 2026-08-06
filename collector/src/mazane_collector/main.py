"""نقطه‌ی ورود گردآورنده: حلقه‌ی polling سکوها + خوراک‌های وب‌سوکت + مراجع.

کرال مؤدب (قاعده‌ی ۶ قراردادها): User-Agent صادق با URL تماس، بازه‌ی ثابت،
داوری `robots.txt` در زمان اجرا (ماژول `robots` — کش ۲۴ ساعته، باز-به-شکست
مستند)، و در شکست فقط لاگ — قطع منبع (و قطع وب‌سوکت) کهنگی است، نه خطا؛
هیچ حلقه‌ای هرگز نمی‌میرد.

هفت تسک موازی:
- حلقه‌ی سکوها (۳۰ ثانیه): همه‌ی آداپترها + چک میانه + فهرست عمومی.
  fetch با `compose_fetch` ساخته می‌شود: داریک «دو خوراک، یک سکو» است —
  فریم تازه‌ی وب‌سوکت اگر بود، وگرنه REST؛ اینوی فقط وب‌سوکت است و سکوت
  خوراکش ⟸ FeedStale ⟸ کهنگی همان سکو.
- حلقه‌ی مراجع (۱۲۰ ثانیه — مؤدبانه‌تر، چون بن‌بست HTML کامل می‌گیرد):
  طلا دات‌آی‌آر و بن‌بست؛ فقط تاریخچه + کلید mazane:reference:{slug}.
- حلقه‌ی نگه‌داری (ساعتی، بلیت ۱۶ — فقط روی پستگرس): تجمیع ساعتی +
  فشرده‌سازی تکراری‌های متوالی + هرس خام کهنه‌تر از ۹۰ روز. نخستین اجرا
  در بوت، جاماندگی (ساعت‌های تجمیع‌نشده) را جبران می‌کند؛ سیاست و
  دروازه‌ها در `mazane_collector.retention` مستندند.
- حلقه‌ی انتشار محتوا (هر ۱۵ دقیقه، بلیت ۱۳ — فقط روی پستگرس): صف
  پیش‌نویس بلاگ را با سقف روزانه‌ی سمت سرور خالی می‌کند — مستقل از شمار
  پیش‌نویس‌ها — و عمق صف را می‌سنجد (هشدار زیر ۵ روز). سیاست‌ها در
  `mazane_collector.content` مستندند.
- حلقه‌ی تنظیمات سکو (۲۰ ثانیه، بلیت ۲۱ — فقط روی پستگرس + ردیس): جدول
  `platform_settings` را می‌خواند (پنل نوشته)، عضویت/رنگ/ترتیب نمودار را
  می‌سازد و به `mazane:chart_config` ردیس می‌نویسد — بدون انتشار تازه‌ی
  وب، تغییر پنل تا نیم دقیقه بعد روی سایت زنده دیده می‌شود. سیاست در
  `mazane_collector.settings` مستند است.
- دو کلاینت وب‌سوکت reconnect دار (داریک SignalR، اینوی) که فقط کش فریم
  را پر می‌کنند.

پیکربندی با متغیر محیطی:
    MAZANE_REDIS_URL          (پیش‌فرض redis://127.0.0.1:6379/0)
    MAZANE_DATABASE_URL       (پیش‌فرض postgresql://mazane:mazane@127.0.0.1:5432/mazane)
    MAZANE_DAILY_PUBLISH_CAP  (پیش‌فرض ۲ — سقف انتشار روزانه‌ی بلاگ)
    MAZANE_REVALIDATE_URL     (پیش‌فرض http://127.0.0.1:3000/api/revalidate-blog)
    MAZANE_REVALIDATE_TOKEN   (بدون پیش‌فرض — ست نباشد بازتولید وب فقط WARNING می‌دهد)

اجرای محلی: `docker compose -f docker-compose.dev.yml up -d` سپس
`mazane-collector` (یا `python -m mazane_collector.main`).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
import httpx
import redis.asyncio as aioredis
import websockets

from .adapters.baazar import BaazarAdapter
from .adapters.daric import (
    DARIC_REST_ENDPOINT,
    DARIC_WS_ENDPOINT,
    SIGNALR_RECORD_SEPARATOR,
    DaricAdapter,
    decode_signalr_message,
)
from .adapters.digikala import DigikalaAdapter
from .adapters.ecogold import EcogoldAdapter
from .adapters.goldika import GoldikaAdapter
from .adapters.hamrahgold import HamrahgoldAdapter
from .adapters.invi import INVI_WS_ENDPOINT, InviAdapter, decode_invi_message
from .adapters.melligold import MelligoldAdapter
from .adapters.milli import MilliAdapter
from .adapters.talasea import TalaseaAdapter
from .adapters.technogold import TechnogoldAdapter
from .adapters.tlyn import TlynAdapter
from .adapters.wallgold import WallgoldAdapter
from .adapters.zarafza import ZarafzaAdapter
from .content.gateway import PostgresContentGateway
from .content.publisher import daily_publish_cap_from_env, drain_pass
from .content.revalidate import revalidator_from_env
from .pipeline import collect_round
from .platforms import PLATFORMS
from .references.pipeline import REFERENCE_SOURCES, collect_reference_round
from .references.transport import HttpxReferenceTransport, RobotsCheckedTransport
from .retention import retention_pass
from .robots import RobotsGate, robots_checked_fetch
from .settings import PostgresSettingsGateway, chart_config_from_settings
from .store import MultiStore
from .store.postgres_store import PostgresStore
from .store.redis_store import RedisStore
from .ws import FeedCache, ReconnectingFeedClient, compose_fetch

POLL_INTERVAL_SECONDS = 30
# مراجع قیمت لحظه‌ای نیستند (tala.ir خودش می‌گوید) و بن‌بست HTML کامل
# می‌دهد ⟸ آهنگ کندتر، مؤدبانه‌تر.
REFERENCE_POLL_INTERVAL_SECONDS = 120
# نگه‌داری بازه‌های «ساعتی» را تجمیع می‌کند ⟸ آهنگ ساعتی کافی است؛ هر گذر
# خودش جاماندگی را جبران می‌کند، پس دیر شدن یک نوبت بی‌هزینه است.
RETENTION_INTERVAL_SECONDS = 3600
# آهنگ ثابت خالی کردن صف محتوا (بلیت ۱۳): هر گذر فقط چک می‌کند «سهم امروز
# مانده؟» — سقف روزانه داخل publish_due است، پس گذر زودهنگام/جامانده بی‌ضرر
# است و ۱۵ دقیقه تأخیر بدترین حالت انتشار سررسید است.
CONTENT_DRAIN_INTERVAL_SECONDS = 900
# تنظیمات پنل (بلیت ۲۱): فقط یک کپی‌کردن جدول کوچک به ردیس است، نه گردآوری
# شبکه‌ای — ۲۰ ثانیه یعنی تغییر پنل «تا نیم دقیقه بعد» روی سایت زنده دیده
# می‌شود (معیار پذیرش تیکت)، بدون فشار محسوس روی پستگرس.
SETTINGS_SYNC_INTERVAL_SECONDS = 20
USER_AGENT = "MazaneBot/0.1 (+https://mazane.online/about)"
HTTP_TIMEOUT_SECONDS = 15

DARIC_NEGOTIATE_URL = "https://apie.daric.gold/ws/hubs/negotiate?negotiateVersion=1"

log = logging.getLogger("mazane.collector")


def _daric_connector(client: httpx.AsyncClient) -> Any:
    """اتصال SignalR داریک: negotiate ⟸ وب‌سوکت با توکن ⟸ handshake پروتکل JSON.

    (transport «WebSockets/JSON» با endpoint ‏negotiate راستی‌آزمایی شده؛
    خود فریم‌ها هنوز نه — هر شکل غیرمنتظره در decode نادیده می‌رود و REST
    خوراک اصلی می‌ماند.)
    """

    @asynccontextmanager
    async def connect() -> AsyncIterator[AsyncIterator[str]]:
        response = await client.post(DARIC_NEGOTIATE_URL)
        response.raise_for_status()
        token = response.json()["connectionToken"]
        async with websockets.connect(
            f"{DARIC_WS_ENDPOINT}?id={token}", user_agent_header=USER_AGENT
        ) as connection:
            await connection.send(
                json.dumps({"protocol": "json", "version": 1}) + SIGNALR_RECORD_SEPARATOR
            )
            yield _text_messages(connection)

    return connect


def _invi_connector() -> Any:
    @asynccontextmanager
    async def connect() -> AsyncIterator[AsyncIterator[str]]:
        async with websockets.connect(
            INVI_WS_ENDPOINT, user_agent_header=USER_AGENT
        ) as connection:
            yield _text_messages(connection)

    return connect


async def _text_messages(connection: Any) -> AsyncIterator[str]:
    async for message in connection:
        yield message if isinstance(message, str) else message.decode()


async def run() -> None:
    redis_url = os.environ.get("MAZANE_REDIS_URL", "redis://127.0.0.1:6379/0")
    database_url = os.environ.get(
        "MAZANE_DATABASE_URL", "postgresql://mazane:mazane@127.0.0.1:5432/mazane"
    )

    adapters = (
        WallgoldAdapter(),
        TalaseaAdapter(),
        MilliAdapter(),
        GoldikaAdapter(),
        TechnogoldAdapter(),
        TlynAdapter(),
        EcogoldAdapter(),
        ZarafzaAdapter(),
        BaazarAdapter(),
        DaricAdapter(),
        MelligoldAdapter(),
        DigikalaAdapter(),
        HamrahgoldAdapter(),
        InviAdapter(),
    )
    redis_client = aioredis.from_url(redis_url, decode_responses=True)
    pool = await asyncpg.create_pool(database_url)
    assert pool is not None
    # نگه‌داری (بلیت ۱۶) فقط با تاریخچه‌ی پستگرس کار دارد — ردیس تاریخچه ندارد.
    history_store = PostgresStore(pool)
    store = MultiStore(RedisStore(redis_client), history_store)
    # صف محتوا (بلیت ۱۳) هم فقط پستگرسی است — همان pool، دروازه‌ی جدای posts.
    content_gateway = PostgresContentGateway(pool)
    daily_publish_cap = daily_publish_cap_from_env()
    # تنظیمات پنل (بلیت ۲۱) هم همان pool مشترک — جدول جدای platform_settings.
    settings_gateway = PostgresSettingsGateway(pool)

    # follow_redirects + cookie jar خود کلاینت: دست‌دهی ArvanCloud ملی‌گلد
    # (۳۰۷ + کوکی — auth نیست؛ سند تحقیق ۰۱، بند ۸.۲) و توکن /json بن‌بست.
    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT},
        timeout=HTTP_TIMEOUT_SECONDS,
        follow_redirects=True,
    ) as client:

        async def http_fetch_json(url: str) -> Any:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()

        # داوری robots.txt با همان کلاینت مشترک (UA صادق)، پیش از هر fetch
        # سکو و مرجع؛ فریم‌های وب‌سوکت کش‌شده fetch ندارند و داوری نمی‌شوند.
        robots = RobotsGate(client, user_agent=USER_AGENT)

        cache = FeedCache()
        # «دو خوراک، یک سکو»: قطع وب‌سوکت داریک حتی کهنگی هم نمی‌سازد —
        # REST جایش را می‌گیرد (بند ۱۲.۳).
        fetch_json = compose_fetch(
            robots_checked_fetch(robots, http_fetch_json),
            cache,
            ws_primary={DARIC_REST_ENDPOINT: DARIC_WS_ENDPOINT},
        )
        daric_feed = ReconnectingFeedClient(
            DARIC_WS_ENDPOINT, _daric_connector(client), decode_signalr_message, cache
        )
        invi_feed = ReconnectingFeedClient(
            INVI_WS_ENDPOINT, _invi_connector(), decode_invi_message, cache
        )
        transport = RobotsCheckedTransport(robots, HttpxReferenceTransport(client))

        async def platform_loop() -> None:
            log.info("گردآورنده بالا آمد؛ بازه %s ثانیه", POLL_INTERVAL_SECONDS)
            while True:
                started = time.monotonic()
                try:
                    snapshots = await collect_round(
                        adapters, fetch_json, store, platforms=PLATFORMS
                    )
                    log.info(
                        "نوبت گردآوری: %s",
                        {
                            s.platform_slug: (
                                "سرکوب‌شده (چک میانه)"
                                if s.suppressed
                                else {q.side.value: q.price_toman for q in s.quotes}
                            )
                            for s in snapshots
                        },
                    )
                except Exception:
                    # کهنگی، نه سقوط: updated_at قبلی می‌ماند و حلقه ادامه می‌دهد.
                    log.exception("نوبت گردآوری شکست خورد")
                elapsed = time.monotonic() - started
                await asyncio.sleep(max(0.0, POLL_INTERVAL_SECONDS - elapsed))

        async def reference_loop() -> None:
            while True:
                started = time.monotonic()
                try:
                    saved = await collect_reference_round(
                        REFERENCE_SOURCES, transport, store
                    )
                    log.info(
                        "نوبت مراجع: %s",
                        {s.reference_slug: len(s.quotes) for s in saved},
                    )
                except Exception:
                    log.exception("نوبت مراجع شکست خورد")
                elapsed = time.monotonic() - started
                await asyncio.sleep(max(0.0, REFERENCE_POLL_INTERVAL_SECONDS - elapsed))

        async def retention_loop() -> None:
            while True:
                started = time.monotonic()
                try:
                    report = await retention_pass(history_store)
                    log.info(
                        "نوبت نگه‌داری: %s تجمیع، %s فشرده، %s هرس",
                        report.rollups_written,
                        report.rows_compressed,
                        report.rows_pruned,
                    )
                except Exception:
                    # مثل بقیه‌ی حلقه‌ها: شکست فقط لاگ می‌شود؛ گذر بعدی جبران می‌کند.
                    log.exception("نوبت نگه‌داری شکست خورد")
                elapsed = time.monotonic() - started
                await asyncio.sleep(max(0.0, RETENTION_INTERVAL_SECONDS - elapsed))

        # بازتولید ISR وب با همان کلاینت مشترک — بی‌توکن فقط WARNING می‌دهد.
        revalidate_blog = revalidator_from_env(client)

        async def content_loop() -> None:
            while True:
                started = time.monotonic()
                try:
                    published, depth = await drain_pass(
                        content_gateway, revalidate_blog, daily_cap=daily_publish_cap
                    )
                    log.info(
                        "نوبت انتشار محتوا: %s منتشر شد؛ عمق صف %.1f روز (%s پیش‌نویس ÷ سقف %s)",
                        list(published) if published else "هیچ",
                        depth.days,
                        depth.drafts,
                        depth.daily_cap,
                    )
                except Exception:
                    # مثل بقیه‌ی حلقه‌ها: شکست فقط لاگ می‌شود؛ گذر بعدی جبران می‌کند.
                    log.exception("نوبت انتشار محتوا شکست خورد")
                elapsed = time.monotonic() - started
                await asyncio.sleep(max(0.0, CONTENT_DRAIN_INTERVAL_SECONDS - elapsed))

        async def settings_sync_loop() -> None:
            """پنل ⟸ پستگرس (`platform_settings`) ⟸ (این حلقه) ⟸ ردیس
            (`mazane:chart_config`) ⟸ نمودار زنده — بدون انتشار تازه (بلیت ۲۱).

            `listed_platforms` عمداً از رجیستری کد است، نه از استور: ثابت و
            بی‌نیاز به ردیس گرم‌شده، و همان تعریف «قابل نمایش» (data_policy=
            ALLOWED) که بقیه‌ی گردآورنده استفاده می‌کند.
            """
            listed_platforms = tuple(p for p in PLATFORMS if p.is_listed)
            while True:
                started = time.monotonic()
                try:
                    settings_rows = await settings_gateway.list_platform_settings()
                    config = chart_config_from_settings(settings_rows, listed_platforms)
                    await store.save_chart_config(config)
                    log.info("نوبت تنظیمات سکو: %s سری در نمودار", len(config))
                except Exception:
                    # مثل بقیه‌ی حلقه‌ها: شکست فقط لاگ می‌شود؛ کلید قبلی می‌ماند.
                    log.exception("نوبت تنظیمات سکو شکست خورد")
                elapsed = time.monotonic() - started
                await asyncio.sleep(max(0.0, SETTINGS_SYNC_INTERVAL_SECONDS - elapsed))

        await asyncio.gather(
            platform_loop(),
            reference_loop(),
            retention_loop(),
            content_loop(),
            settings_sync_loop(),
            daric_feed.run(),
            invi_feed.run(),
        )


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    asyncio.run(run())


if __name__ == "__main__":
    main()
