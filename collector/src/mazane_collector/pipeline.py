"""خط لوله‌ی گردآوری: fetch → parse → save.

مرز تست گردآورنده همین‌جاست: payload (در تست، فیکسچر ضبط‌شده) وارد می‌شود و
ردیف‌های ذخیره‌شده در استور بیرون می‌آید. شبکه با `fetch_json` تزریق می‌شود
تا تست‌ها هیچ تماس شبکه‌ای نداشته باشند.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any, Protocol

from .models import PlatformSnapshot
from .store import Store

FetchJson = Callable[[str], Awaitable[Any]]


class AdapterError(Exception):
    """payload منبع قابل تبدیل به اسنپ‌شات نیست (فیلد غایب، قیمت تهی و…)."""


class Adapter(Protocol):
    """هر آداپتر: یک endpoint و یک تبدیلِ payload به اسنپ‌شات نرمال‌شده."""

    slug: str
    endpoint: str

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
