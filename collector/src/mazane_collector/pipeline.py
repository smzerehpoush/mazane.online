"""خط لوله‌ی گردآوری: fetch → parse → چک میانه → save.

مرز تست گردآورنده همین‌جاست: payload (در تست، فیکسچر ضبط‌شده) وارد می‌شود و
ردیف‌های ذخیره‌شده در استور بیرون می‌آید. شبکه با `fetch_json` تزریق می‌شود
تا تست‌ها هیچ تماس شبکه‌ای نداشته باشند.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Sequence
from datetime import UTC, datetime
from typing import Any, Protocol

from .instruments import build_listings
from .models import Instrument, Platform, PlatformSnapshot
from .sanity import median_outliers
from .store import Store

FetchJson = Callable[[str], Awaitable[Any]]

log = logging.getLogger("mazane.collector.pipeline")


class AdapterError(Exception):
    """payload منبع قابل تبدیل به اسنپ‌شات نیست (فیلد غایب، قیمت تهی و…)."""


class Adapter(Protocol):
    """هر آداپتر: یک endpoint و یک تبدیلِ payload به اسنپ‌شات نرمال‌شده.

    `instruments` اعلام صریح دارایی‌هایی است که این آداپتر تولید می‌کند —
    رجیستری زنده‌ی دروازه‌ی انتشار (بند ۱۳، تصمیم ۱۰) از همین فیلد شمار
    سکوهای پشتیبان هر دارایی را می‌گیرد.
    """

    slug: str
    endpoint: str
    instruments: tuple[Instrument, ...]

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot: ...


async def collect_once(
    adapter: Adapter,
    fetch_json: FetchJson,
    store: Store,
    *,
    now: datetime | None = None,
) -> PlatformSnapshot:
    """یک نوبت گردآوری برای یک سکو. خطا را بالا می‌دهد؛ حلقه‌ی اصلی لاگ می‌کند.

    شکست یعنی «هیچ‌چیز نوشته نشود» — قطع منبع کهنگی است، نه داده‌ی خراب.
    """
    fetched_at = now if now is not None else datetime.now(UTC)
    payload = await fetch_json(adapter.endpoint)
    snapshot = adapter.parse(payload, fetched_at)
    await store.save_snapshot(snapshot)
    return snapshot


async def collect_round(
    adapters: Sequence[Adapter],
    fetch_json: FetchJson,
    store: Store,
    *,
    platforms: Sequence[Platform],
    now: datetime | None = None,
) -> tuple[PlatformSnapshot, ...]:
    """یک نوبت گردآوری برای همه‌ی سکوها + چک میانه‌ی تقاطعی + فهرست عمومی.

    - قطع یک منبع کل نوبت را نمی‌کشد: فقط لاگ می‌شود و آن سکو کهنه می‌ماند.
    - چک میانه (قاعده‌ی ۳ قراردادها): mid هر منبع تازه با میانه‌ی سایر منابع
      تازه مقایسه می‌شود؛ انحراف بیش از آستانه ⟸ همان اسنپ‌شات با
      `suppressed=True` ذخیره می‌شود (تاریخچه بله، قیمت جاری هرگز) + هشدار.
      با کمتر از ۳ منبع تازه رأی‌گیری ممکن نیست و چک اجرا نمی‌شود.
    - فهرست عمومی هر نوبت بازنویسی می‌شود تا استور جاری (ردیس) بعد از
      ری‌استارت هم بدون دیپلوی درست باشد.
    - payload دارایی‌ها (بلیت ۷) هم هر نوبت از رجیستری زنده بازنویسی
      می‌شود: با فعال شدن سکوی دوم یک دارایی، `published` در همان نوبت
      True می‌شود و صفحه‌ی وب خودکار ساخته می‌شود (بند ۱۳، تصمیم ۱۰).
    """
    fetched_at = now if now is not None else datetime.now(UTC)

    fresh: list[PlatformSnapshot] = []
    for adapter in adapters:
        try:
            payload = await fetch_json(adapter.endpoint)
            fresh.append(adapter.parse(payload, fetched_at))
        except Exception:
            # کهنگی، نه خطا: updated_at قبلی این سکو می‌ماند و نوبت ادامه دارد.
            log.exception("گردآوری %s شکست خورد — سکو کهنه می‌ماند", adapter.slug)

    outliers = median_outliers(fresh)
    saved: list[PlatformSnapshot] = []
    for snapshot in fresh:
        if snapshot.platform_slug in outliers:
            log.warning(
                "چک میانه: %s بیش از آستانه از میانه‌ی سایر منابع فاصله دارد "
                "— منتشر نمی‌شود (فقط تاریخچه، با پرچم سرکوب)",
                snapshot.platform_slug,
            )
            snapshot = snapshot.model_copy(update={"suppressed": True})
        await store.save_snapshot(snapshot)
        saved.append(snapshot)

    await store.save_platforms(platforms)
    await store.save_instruments(build_listings(adapters, platforms))
    return tuple(saved)
