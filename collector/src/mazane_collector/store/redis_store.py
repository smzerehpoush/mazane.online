"""استور ردیس — قیمت جاری برای لایه‌ی وب.

الگوی برداشته‌شده از خزنده‌ی مرجع (بند ۳ سند معماری): قیمت با TTL ذخیره
می‌شود ولی `updated_at` جدا و **بدون TTL** — وقتی منبعی قطع شد، وب به‌جای
عدد بیات «آخرین به‌روزرسانی: N دقیقه پیش» را نشان می‌دهد.

کلیدها (قرارداد مشترک با `web/lib/redis-source.ts`):
    mazane:current:{slug}     ← JSON کامل PlatformSnapshot، با TTL
    mazane:updated_at:{slug}  ← ISO-8601، بدون TTL
    mazane:listed             ← آرایه‌ی JSON سکوهای قابل نمایش (فقط ALLOWED)
    mazane:instruments        ← آرایه‌ی JSON دارایی‌ها (بلیت ۷) با وضعیت
                                دروازه‌ی انتشار (published) و سکوهای پشتیبان
                                — بدون TTL، مثل فهرست: فراداده است نه قیمت
    mazane:reference:{slug}   ← JSON کامل ReferenceSnapshot (با ذکر منبع)، با TTL
                                — مرجع قیمت سکو نیست و هرگز در mazane:listed
                                یا mazane:current نمی‌آید (بند ۱۲.۲)
    mazane:chart_config       ← آرایه‌ی JSON سری‌های نمودار صفحه‌ی اصلی (بلیت
                                ۲۱)، همگام‌شده از تنظیمات پنل — بدون TTL،
                                فراداده است نه قیمت

وب `mazane:listed` را همان‌طور که هست رندر می‌کند — فیلتر نمایش عمومی
(گلدیکا و هر PERMISSION_PENDING دیگر) همین‌جا اعمال شده است، نه در وب.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from ..instruments import InstrumentListing
from ..models import Platform, PlatformSnapshot
from ..references import ReferenceSnapshot
from ..settings import ChartConfigEntry

DEFAULT_PRICE_TTL_SECONDS = 120
# مراجع با آهنگ کندتر (مؤدبانه) گردآوری می‌شوند ⟸ TTL بلندتر؛ کهنگی را
# fetched_at داخل خود اسنپ‌شات نشان می‌دهد.
DEFAULT_REFERENCE_TTL_SECONDS = 900

LISTED_KEY = "mazane:listed"
INSTRUMENTS_KEY = "mazane:instruments"
CHART_CONFIG_KEY = "mazane:chart_config"


def current_key(platform_slug: str) -> str:
    return f"mazane:current:{platform_slug}"


def updated_at_key(platform_slug: str) -> str:
    return f"mazane:updated_at:{platform_slug}"


def reference_key(reference_slug: str) -> str:
    return f"mazane:reference:{reference_slug}"


class RedisStore:
    def __init__(
        self,
        client: Any,
        price_ttl_seconds: int = DEFAULT_PRICE_TTL_SECONDS,
        reference_ttl_seconds: int = DEFAULT_REFERENCE_TTL_SECONDS,
    ) -> None:
        """`client` یک `redis.asyncio.Redis` است (تزریقی، برای تست‌پذیری)."""
        self._client = client
        self._price_ttl_seconds = price_ttl_seconds
        self._reference_ttl_seconds = reference_ttl_seconds

    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        if snapshot.suppressed:
            # رد چک میانه: ردیس فقط قیمت جاری است — سرکوب یعنی هیچ‌چیز نوشته
            # نشود؛ ثبت تاریخچه (با پرچم) کار استور پستگرس است.
            return
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

    async def save_platforms(self, platforms: Sequence[Platform]) -> None:
        listed = [p.model_dump(mode="json") for p in platforms if p.is_listed]
        # بدون TTL — فهرست، فراداده‌ی ثابت است نه قیمت.
        await self._client.set(LISTED_KEY, json.dumps(listed, ensure_ascii=False))

    async def get_listed_platforms(self) -> tuple[Platform, ...]:
        raw = await self._client.get(LISTED_KEY)
        if raw is None:
            return ()
        text = raw.decode() if isinstance(raw, bytes) else raw
        return tuple(Platform.model_validate(item) for item in json.loads(text))

    async def save_instruments(self, listings: Sequence[InstrumentListing]) -> None:
        payload = [listing.model_dump(mode="json") for listing in listings]
        # بدون TTL — فراداده‌ی رجیستری است نه قیمت؛ published=False ها هم
        # می‌مانند تا وب بتواند دروازه‌ی رد را صریح 404 کند (بلیت ۷).
        await self._client.set(INSTRUMENTS_KEY, json.dumps(payload, ensure_ascii=False))

    async def get_instruments(self) -> tuple[InstrumentListing, ...]:
        raw = await self._client.get(INSTRUMENTS_KEY)
        if raw is None:
            return ()
        text = raw.decode() if isinstance(raw, bytes) else raw
        return tuple(InstrumentListing.model_validate(item) for item in json.loads(text))

    async def save_reference(self, snapshot: ReferenceSnapshot) -> None:
        await self._client.set(
            reference_key(snapshot.reference_slug),
            snapshot.model_dump_json(),
            ex=self._reference_ttl_seconds,
        )

    async def get_reference(self, reference_slug: str) -> ReferenceSnapshot | None:
        raw = await self._client.get(reference_key(reference_slug))
        if raw is None:
            return None
        return ReferenceSnapshot.model_validate_json(raw)

    async def save_chart_config(self, entries: Sequence[ChartConfigEntry]) -> None:
        payload = [entry.model_dump(mode="json") for entry in entries]
        # بدون TTL — فراداده‌ی نمودار است نه قیمت، مثل mazane:listed.
        await self._client.set(CHART_CONFIG_KEY, json.dumps(payload, ensure_ascii=False))

    async def get_chart_config(self) -> tuple[ChartConfigEntry, ...]:
        raw = await self._client.get(CHART_CONFIG_KEY)
        if raw is None:
            return ()
        text = raw.decode() if isinstance(raw, bytes) else raw
        return tuple(ChartConfigEntry.model_validate(item) for item in json.loads(text))
