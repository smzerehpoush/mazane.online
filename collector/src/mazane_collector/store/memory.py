"""فیک درون‌حافظه‌ای استور — برای تست‌ها و اجرای بدون سرویس زنده."""

from __future__ import annotations

from datetime import datetime

from ..models import PlatformSnapshot


class InMemoryStore:
    def __init__(self) -> None:
        self._snapshots: dict[str, PlatformSnapshot] = {}
        self._updated_at: dict[str, datetime] = {}

    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        self._snapshots[snapshot.platform_slug] = snapshot
        self._updated_at[snapshot.platform_slug] = snapshot.fetched_at

    async def get_snapshot(self, platform_slug: str) -> PlatformSnapshot | None:
        return self._snapshots.get(platform_slug)

    async def get_updated_at(self, platform_slug: str) -> datetime | None:
        return self._updated_at.get(platform_slug)
