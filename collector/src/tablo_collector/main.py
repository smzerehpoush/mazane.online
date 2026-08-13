from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections.abc import AsyncIterator, Sequence
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
from .models import Platform
from .pipeline import collect_round
from .platforms import PLATFORMS
from .references.pipeline import REFERENCE_SOURCES, collect_reference_round
from .references.transport import HttpxReferenceTransport, RobotsCheckedTransport
from .retention import retention_pass
from .robots import RobotsGate, robots_checked_fetch
from .settings import (
    PostgresSettingsGateway,
    chart_config_from_settings,
    platforms_with_referral_overrides,
)
from .store import MultiStore
from .store.postgres_store import PostgresStore
from .store.redis_store import RedisStore
from .ws import FeedCache, ReconnectingFeedClient, compose_fetch

POLL_INTERVAL_SECONDS = 30
REFERENCE_POLL_INTERVAL_SECONDS = 120
RETENTION_INTERVAL_SECONDS = 3600
CONTENT_DRAIN_INTERVAL_SECONDS = 900
SETTINGS_SYNC_INTERVAL_SECONDS = 20
USER_AGENT = "TabloBot/0.1 (+https://tablo.gold/about)"
HTTP_TIMEOUT_SECONDS = 15

DARIC_NEGOTIATE_URL = "https://apie.daric.gold/ws/hubs/negotiate?negotiateVersion=1"

log = logging.getLogger("mazane.collector")


def _daric_connector(client: httpx.AsyncClient) -> Any:
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


class _PlatformRegistry:
    def __init__(self, platforms: Sequence[Platform]) -> None:
        self.current: tuple[Platform, ...] = tuple(platforms)


async def run() -> None:
    redis_url = os.environ.get("TABLO_REDIS_URL", "redis://127.0.0.1:6379/0")
    database_url = os.environ.get(
        "TABLO_DATABASE_URL", "postgresql://mazane:mazane@127.0.0.1:5432/mazane"
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
    history_store = PostgresStore(pool)
    store = MultiStore(RedisStore(redis_client), history_store)
    content_gateway = PostgresContentGateway(pool)
    daily_publish_cap = daily_publish_cap_from_env()
    settings_gateway = PostgresSettingsGateway(pool)
    platform_registry = _PlatformRegistry(PLATFORMS)

    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT},
        timeout=HTTP_TIMEOUT_SECONDS,
        follow_redirects=True,
    ) as client:

        async def http_fetch_json(url: str) -> Any:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()

        robots = RobotsGate(client, user_agent=USER_AGENT)

        cache = FeedCache()
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
                        adapters, fetch_json, store, platforms=platform_registry.current
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
                    log.exception("نوبت نگه‌داری شکست خورد")
                elapsed = time.monotonic() - started
                await asyncio.sleep(max(0.0, RETENTION_INTERVAL_SECONDS - elapsed))

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
                    log.exception("نوبت انتشار محتوا شکست خورد")
                elapsed = time.monotonic() - started
                await asyncio.sleep(max(0.0, CONTENT_DRAIN_INTERVAL_SECONDS - elapsed))

        async def settings_sync_loop() -> None:
            listed_platforms = tuple(p for p in PLATFORMS if p.is_listed)
            while True:
                started = time.monotonic()
                try:
                    settings_rows = await settings_gateway.list_platform_settings()
                    config = chart_config_from_settings(settings_rows, listed_platforms)
                    await store.save_chart_config(config)
                    platform_registry.current = platforms_with_referral_overrides(
                        settings_rows, PLATFORMS
                    )
                    log.info("نوبت تنظیمات سکو: %s سری در نمودار", len(config))
                except Exception:
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
