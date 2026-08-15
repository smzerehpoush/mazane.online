from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import NamedTuple, Protocol

from pydantic import BaseModel, ConfigDict

log = logging.getLogger("mazane.collector.retention")

RAW_RETENTION = timedelta(days=90)
COMPRESSION_LOOKBACK = timedelta(hours=25)


class SourceKind(StrEnum):
    PLATFORM = "PLATFORM"
    REFERENCE = "REFERENCE"


class RawRow(BaseModel):
    model_config = ConfigDict(frozen=True)

    row_id: int
    kind: SourceKind
    source_slug: str
    instrument: str
    side: str
    value: Decimal
    raw_value: Decimal
    raw_scale: Decimal
    fetched_at: datetime
    suppressed: bool = False


class RollupKey(NamedTuple):
    kind: SourceKind
    source_slug: str
    instrument: str
    side: str
    hour_start: datetime


class HourlyRollup(BaseModel):
    model_config = ConfigDict(frozen=True)

    kind: SourceKind
    source_slug: str
    instrument: str
    side: str
    hour_start: datetime
    open_value: Decimal
    close_value: Decimal
    min_value: Decimal
    max_value: Decimal
    sample_count: int

    @property
    def key(self) -> RollupKey:
        return RollupKey(self.kind, self.source_slug, self.instrument, self.side, self.hour_start)


class RetentionStore(Protocol):
    async def load_raw_rows(
        self, *, until: datetime, since: datetime | None = None
    ) -> tuple[RawRow, ...]:
        ...

    async def latest_rollup_hour(self) -> datetime | None:
        ...

    async def load_rollup_keys(
        self, *, until: datetime, since: datetime | None = None
    ) -> frozenset[RollupKey]:
        ...

    async def upsert_rollups(self, rollups: Sequence[HourlyRollup]) -> None:
        ...

    async def delete_raw_rows(self, rows: Sequence[RawRow]) -> None:
        ...

    async def get_hourly_rollups(
        self,
        kind: SourceKind,
        source_slug: str,
        instrument: str | None = None,
        *,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[HourlyRollup, ...]:
        ...


class RetentionReport(NamedTuple):
    rollups_written: int
    rows_compressed: int
    rows_pruned: int


def hour_floor(moment: datetime) -> datetime:
    return moment.replace(minute=0, second=0, microsecond=0)


def row_key(row: RawRow) -> RollupKey:
    return RollupKey(row.kind, row.source_slug, row.instrument, row.side, hour_floor(row.fetched_at))


def build_rollups(rows: Sequence[RawRow]) -> tuple[HourlyRollup, ...]:
    groups: dict[RollupKey, list[RawRow]] = {}
    for row in rows:
        if row.suppressed:
            continue
        groups.setdefault(row_key(row), []).append(row)

    rollups: list[HourlyRollup] = []
    for key in sorted(groups):
        members = sorted(groups[key], key=lambda r: (r.fetched_at, r.row_id))
        values = [member.value for member in members]
        rollups.append(
            HourlyRollup(
                kind=key.kind,
                source_slug=key.source_slug,
                instrument=key.instrument,
                side=key.side,
                hour_start=key.hour_start,
                open_value=members[0].value,
                close_value=members[-1].value,
                min_value=min(values),
                max_value=max(values),
                sample_count=len(members),
            )
        )
    return tuple(rollups)


def duplicate_run_victims(rows: Sequence[RawRow]) -> tuple[RawRow, ...]:
    series: dict[tuple[SourceKind, str, str, str], list[RawRow]] = {}
    for row in rows:
        series.setdefault((row.kind, row.source_slug, row.instrument, row.side), []).append(row)

    victims: list[RawRow] = []
    for members in series.values():
        members.sort(key=lambda r: (r.fetched_at, r.row_id))
        run: list[RawRow] = []
        for row in members:
            if run and (row.value, row.raw_value, row.raw_scale) != (
                run[0].value,
                run[0].raw_value,
                run[0].raw_scale,
            ):
                victims.extend(run[1:-1])
                run = []
            run.append(row)
        victims.extend(run[1:-1])
    return tuple(victims)


async def rollup_completed_hours(
    store: RetentionStore, *, now: datetime | None = None
) -> tuple[HourlyRollup, ...]:
    moment = now if now is not None else datetime.now(UTC)
    until = hour_floor(moment)
    since = await store.latest_rollup_hour()
    rows = await store.load_raw_rows(until=until, since=since)
    rollups = build_rollups(rows)
    if rollups:
        await store.upsert_rollups(rollups)
    return rollups


async def compress_duplicate_runs(
    store: RetentionStore,
    *,
    now: datetime | None = None,
    lookback: timedelta = COMPRESSION_LOOKBACK,
) -> int:
    moment = now if now is not None else datetime.now(UTC)
    until = hour_floor(moment)
    since = until - lookback
    rows = await store.load_raw_rows(until=until, since=since)
    rolled = await store.load_rollup_keys(until=until, since=since)
    published = [row for row in rows if not row.suppressed]
    victims = [row for row in duplicate_run_victims(published) if row_key(row) in rolled]
    if victims:
        await store.delete_raw_rows(victims)
    return len(victims)


async def prune_expired_raw(
    store: RetentionStore,
    *,
    now: datetime | None = None,
    retention: timedelta = RAW_RETENTION,
) -> int:
    moment = now if now is not None else datetime.now(UTC)
    cutoff = moment - retention
    rows = await store.load_raw_rows(until=cutoff)
    rolled = await store.load_rollup_keys(until=cutoff)
    victims = [row for row in rows if not row.suppressed and row_key(row) in rolled]
    skipped = sum(1 for row in rows if not row.suppressed) - len(victims)
    if skipped:
        log.warning("prune: %s stale rows remained without their interval's rollup", skipped)
    if victims:
        await store.delete_raw_rows(victims)
    return len(victims)


async def retention_pass(
    store: RetentionStore,
    *,
    now: datetime | None = None,
    retention: timedelta = RAW_RETENTION,
    lookback: timedelta = COMPRESSION_LOOKBACK,
) -> RetentionReport:
    rollups = await rollup_completed_hours(store, now=now)
    compressed = await compress_duplicate_runs(store, now=now, lookback=lookback)
    pruned = await prune_expired_raw(store, now=now, retention=retention)
    return RetentionReport(len(rollups), compressed, pruned)
