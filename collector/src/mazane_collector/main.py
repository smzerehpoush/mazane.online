"""نقطه‌ی ورود گردآورنده: حلقه‌ی polling با بازه‌ی ۳۰ ثانیه.

کرال مؤدب (قاعده‌ی ۶ قراردادها): User-Agent صادق با URL تماس، بازه‌ی ثابت،
و در شکست فقط لاگ — قطع منبع کهنگی است، نه خطا؛ حلقه هرگز نمی‌میرد.

پیکربندی با متغیر محیطی:
    MAZANE_REDIS_URL     (پیش‌فرض redis://127.0.0.1:6379/0)
    MAZANE_DATABASE_URL  (پیش‌فرض postgresql://mazane:mazane@127.0.0.1:5432/mazane)

اجرای محلی: `docker compose -f docker-compose.dev.yml up -d` سپس
`mazane-collector` (یا `python -m mazane_collector.main`).
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

import asyncpg
import httpx
import redis.asyncio as aioredis

from .adapters.goldika import GoldikaAdapter
from .adapters.milli import MilliAdapter
from .adapters.talasea import TalaseaAdapter
from .adapters.wallgold import WallgoldAdapter
from .pipeline import collect_round
from .platforms import PLATFORMS
from .store import MultiStore
from .store.postgres_store import PostgresStore
from .store.redis_store import RedisStore

POLL_INTERVAL_SECONDS = 30
USER_AGENT = "MazaneBot/0.1 (+https://mazane.online/about)"
HTTP_TIMEOUT_SECONDS = 15

log = logging.getLogger("mazane.collector")


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
    )
    redis_client = aioredis.from_url(redis_url, decode_responses=True)
    pool = await asyncpg.create_pool(database_url)
    assert pool is not None
    store = MultiStore(RedisStore(redis_client), PostgresStore(pool))

    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT}, timeout=HTTP_TIMEOUT_SECONDS
    ) as client:

        async def fetch_json(url: str) -> Any:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()

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


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    asyncio.run(run())


if __name__ == "__main__":
    main()
