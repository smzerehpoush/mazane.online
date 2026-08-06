"""فیک درون‌حافظه‌ای استور — برای تست‌ها و اجرای بدون سرویس زنده.

`history` همه‌ی اسنپ‌شات‌ها را (سرکوب‌شده یا نه) نگه می‌دارد — معادل تاریخچه‌ی
پستگرس؛ تست‌ها پرچم `suppressed` را از همین‌جا می‌بینند.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from ..models import Platform, PlatformSnapshot


class InMemoryStore:
    def __init__(self) -> None:
        self._snapshots: dict[str, PlatformSnapshot] = {}
        self._updated_at: dict[str, datetime] = {}
        self._platforms: tuple[Platform, ...] = ()
        self.history: list[PlatformSnapshot] = []

    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        self.history.append(snapshot)
        if snapshot.suppressed:
            # رد چک میانه: در قیمت جاری منتشر نمی‌شود، updated_at هم جلو نمی‌رود
            # — از دید وب مثل کهنگی است.
            return
        self._snapshots[snapshot.platform_slug] = snapshot
        self._updated_at[snapshot.platform_slug] = snapshot.fetched_at

    async def get_snapshot(self, platform_slug: str) -> PlatformSnapshot | None:
        return self._snapshots.get(platform_slug)

    async def get_updated_at(self, platform_slug: str) -> datetime | None:
        return self._updated_at.get(platform_slug)

    async def save_platforms(self, platforms: Sequence[Platform]) -> None:
        self._platforms = tuple(platforms)

    async def get_listed_platforms(self) -> tuple[Platform, ...]:
        return tuple(p for p in self._platforms if p.is_listed)
