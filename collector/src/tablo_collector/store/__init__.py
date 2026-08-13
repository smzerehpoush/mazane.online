from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from ..instruments import InstrumentListing
from ..models import Platform, PlatformSnapshot
from ..references import ReferenceSnapshot
from ..settings import ChartConfigEntry


# ⚠️ اسنپ‌شات `suppressed` هرگز به قیمت جاری/`updated_at` نمی‌رسد؛ فقط تاریخچه.
# ⚠️ فهرست عمومی فقط سکوهای `is_listed` را دارد — لایه‌ی وب هیچ فیلتری ندارد.
class Store(Protocol):
    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        ...

    async def get_snapshot(self, platform_slug: str) -> PlatformSnapshot | None:
        ...

    async def get_updated_at(self, platform_slug: str) -> datetime | None:
        ...

    async def save_platforms(self, platforms: Sequence[Platform]) -> None:
        ...

    async def get_listed_platforms(self) -> tuple[Platform, ...]:
        ...

    async def save_reference(self, snapshot: ReferenceSnapshot) -> None:
        ...

    async def get_reference(self, reference_slug: str) -> ReferenceSnapshot | None:
        ...

    async def save_instruments(self, listings: Sequence[InstrumentListing]) -> None:
        ...

    async def get_instruments(self) -> tuple[InstrumentListing, ...]:
        ...

    async def save_chart_config(self, entries: Sequence[ChartConfigEntry]) -> None:
        ...

    async def get_chart_config(self) -> tuple[ChartConfigEntry, ...]:
        ...


class MultiStore:
    def __init__(self, primary: Store, *others: Store) -> None:
        self._stores: tuple[Store, ...] = (primary, *others)

    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        for store in self._stores:
            await store.save_snapshot(snapshot)

    async def get_snapshot(self, platform_slug: str) -> PlatformSnapshot | None:
        return await self._stores[0].get_snapshot(platform_slug)

    async def get_updated_at(self, platform_slug: str) -> datetime | None:
        return await self._stores[0].get_updated_at(platform_slug)

    async def save_platforms(self, platforms: Sequence[Platform]) -> None:
        for store in self._stores:
            await store.save_platforms(platforms)

    async def get_listed_platforms(self) -> tuple[Platform, ...]:
        return await self._stores[0].get_listed_platforms()

    async def save_reference(self, snapshot: ReferenceSnapshot) -> None:
        for store in self._stores:
            await store.save_reference(snapshot)

    async def get_reference(self, reference_slug: str) -> ReferenceSnapshot | None:
        return await self._stores[0].get_reference(reference_slug)

    async def save_instruments(self, listings: Sequence[InstrumentListing]) -> None:
        for store in self._stores:
            await store.save_instruments(listings)

    async def get_instruments(self) -> tuple[InstrumentListing, ...]:
        return await self._stores[0].get_instruments()

    async def save_chart_config(self, entries: Sequence[ChartConfigEntry]) -> None:
        for store in self._stores:
            await store.save_chart_config(entries)

    async def get_chart_config(self) -> tuple[ChartConfigEntry, ...]:
        return await self._stores[0].get_chart_config()
