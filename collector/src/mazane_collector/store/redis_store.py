"""استور ردیس — قیمت جاری برای لایه‌ی وب.

الگوی برداشته‌شده از خزنده‌ی مرجع (بند ۳ سند معماری): قیمت با TTL ذخیره
می‌شود ولی `updated_at` جدا و **بدون TTL** — وقتی منبعی قطع شد، وب به‌جای
عدد بیات «آخرین به‌روزرسانی: N دقیقه پیش» را نشان می‌دهد.

کلیدها (قرارداد مشترک با `web/lib/redis-source.ts`):
    mazane:current:{slug}     ← JSON کامل PlatformSnapshot، با TTL
    mazane:updated_at:{slug}  ← ISO-8601، بدون TTL
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from ..models import PlatformSnapshot

DEFAULT_PRICE_TTL_SECONDS = 120


def current_key(platform_slug: str) -> str:
    return f"mazane:current:{platform_slug}"


def updated_at_key(platform_slug: str) -> str:
    return f"mazane:updated_at:{platform_slug}"


class RedisStore:
    def __init__(self, client: Any, price_ttl_seconds: int = DEFAULT_PRICE_TTL_SECONDS) -> None:
        """`client` یک `redis.asyncio.Redis` است (تزریقی، برای تست‌پذیری)."""
        self._client = client
        self._price_ttl_seconds = price_ttl_seconds

    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        await self._client.set(
            current_key(snapshot.platform_slug),
            snapshot.model_dump_json(),
            ex=self._price_ttl_seconds,
        )
        # بدون TTL — عمداً. کهنگی سیگنال است، نه خطا.
        await self._client.set(
            updated_at_key(snapshot.platform_slug),
            snapshot.fetched_at.isoformat(),
        )

    async def get_snapshot(self, platform_slug: str) -> PlatformSnapshot | None:
        raw = await self._client.get(current_key(platform_slug))
        if raw is None:
            return None
        return PlatformSnapshot.model_validate_json(raw)

    async def get_updated_at(self, platform_slug: str) -> datetime | None:
        raw = await self._client.get(updated_at_key(platform_slug))
        if raw is None:
            return None
        text = raw.decode() if isinstance(raw, bytes) else raw
        return datetime.fromisoformat(text)
