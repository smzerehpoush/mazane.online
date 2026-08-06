"""فیک درون‌حافظه‌ای استور — برای تست‌ها و اجرای بدون سرویس زنده.

`history` همه‌ی اسنپ‌شات‌ها را (سرکوب‌شده یا نه) نگه می‌دارد — معادل تاریخچه‌ی
پستگرس؛ تست‌ها پرچم `suppressed` را از همین‌جا می‌بینند. مراجع قیمت جدا از
سکوها نگه داشته می‌شوند (`reference_history` + کلید جاری خودشان) و هرگز در
فهرست عمومی نمی‌آیند — همان قرارداد ردیس/پستگرس.

برای بلیت ۱۶ همان سطح تماس `RetentionStore` پستگرس را هم پیاده می‌کند:
ردیف‌های خامِ ردیف‌به‌ردیف (با شناسه، مثل bigserial) و جدول تجمیع ساعتی —
تا کارهای نگه‌داری بدون پستگرس زنده در مرز گردآورنده تست شوند.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal

from ..instruments import InstrumentListing
from ..models import Platform, PlatformSnapshot
from ..references import ReferenceSnapshot
from ..retention import HourlyRollup, RawRow, RollupKey, SourceKind
from ..settings import ChartConfigEntry


class InMemoryStore:
    def __init__(self) -> None:
        self._snapshots: dict[str, PlatformSnapshot] = {}
        self._updated_at: dict[str, datetime] = {}
        self._platforms: tuple[Platform, ...] = ()
        self._instruments: tuple[InstrumentListing, ...] = ()
        self._references: dict[str, ReferenceSnapshot] = {}
        self._chart_config: tuple[ChartConfigEntry, ...] = ()
        self.history: list[PlatformSnapshot] = []
        self.reference_history: list[ReferenceSnapshot] = []
        self._raw_rows: list[RawRow] = []
        self._rollups: dict[RollupKey, HourlyRollup] = {}
        self._next_row_id = 1

    def _append_raw(self, row: RawRow) -> None:
        self._raw_rows.append(row)
        self._next_row_id += 1

    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        self.history.append(snapshot)
        for quote in snapshot.quotes:
            self._append_raw(
                RawRow(
                    row_id=self._next_row_id,
                    kind=SourceKind.PLATFORM,
                    source_slug=quote.platform_slug,
                    instrument=quote.instrument.value,
                    side=quote.side.value,
                    value=Decimal(quote.price_toman),
                    raw_value=quote.raw_value,
                    raw_scale=quote.raw_scale,
                    fetched_at=quote.fetched_at,
                    suppressed=snapshot.suppressed,
                )
            )
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

    async def save_instruments(self, listings: Sequence[InstrumentListing]) -> None:
        self._instruments = tuple(listings)

    async def get_instruments(self) -> tuple[InstrumentListing, ...]:
        return self._instruments

    async def save_reference(self, snapshot: ReferenceSnapshot) -> None:
        self.reference_history.append(snapshot)
        self._references[snapshot.reference_slug] = snapshot
        for quote in snapshot.quotes:
            self._append_raw(
                RawRow(
                    row_id=self._next_row_id,
                    kind=SourceKind.REFERENCE,
                    source_slug=quote.reference_slug,
                    instrument=quote.instrument.value,
                    side=quote.side.value,
                    value=quote.value,
                    raw_value=quote.raw_value,
                    raw_scale=quote.raw_scale,
                    fetched_at=quote.fetched_at,
                )
            )

    async def get_reference(self, reference_slug: str) -> ReferenceSnapshot | None:
        return self._references.get(reference_slug)

    async def save_chart_config(self, entries: Sequence[ChartConfigEntry]) -> None:
        self._chart_config = tuple(entries)

    async def get_chart_config(self) -> tuple[ChartConfigEntry, ...]:
        return self._chart_config

    # --- سطح تماس RetentionStore (بلیت ۱۶) — همان قرارداد پستگرس ---

    async def load_raw_rows(
        self, *, until: datetime, since: datetime | None = None
    ) -> tuple[RawRow, ...]:
        return tuple(
            row
            for row in self._raw_rows
            if row.fetched_at < until and (since is None or row.fetched_at >= since)
        )

    async def latest_rollup_hour(self) -> datetime | None:
        return max((key.hour_start for key in self._rollups), default=None)

    async def load_rollup_keys(
        self, *, until: datetime, since: datetime | None = None
    ) -> frozenset[RollupKey]:
        return frozenset(
            key
            for key in self._rollups
            if key.hour_start < until and (since is None or key.hour_start >= since)
        )

    async def upsert_rollups(self, rollups: Sequence[HourlyRollup]) -> None:
        for rollup in rollups:
            self._rollups[rollup.key] = rollup

    async def delete_raw_rows(self, rows: Sequence[RawRow]) -> None:
        doomed = {(row.kind, row.row_id) for row in rows}
        self._raw_rows = [
            row for row in self._raw_rows if (row.kind, row.row_id) not in doomed
        ]

    async def get_hourly_rollups(
        self,
        kind: SourceKind,
        source_slug: str,
        instrument: str | None = None,
        *,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[HourlyRollup, ...]:
        matches = [
            rollup
            for rollup in self._rollups.values()
            if rollup.kind is kind
            and rollup.source_slug == source_slug
            and (instrument is None or rollup.instrument == instrument)
            and (since is None or rollup.hour_start >= since)
            and (until is None or rollup.hour_start < until)
        ]
        matches.sort(key=lambda r: (r.hour_start, r.instrument, r.side))
        return tuple(matches)
