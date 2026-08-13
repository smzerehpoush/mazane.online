from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from ..instruments import InstrumentListing
from ..platforms import PLATFORM_BY_SLUG, registry_order
from ..models import (
    DataPolicy,
    FeeSource,
    Instrument,
    MarketModel,
    Platform,
    PlatformSnapshot,
    PlatformTerms,
    Quote,
    Side,
)
from ..references import (
    ReferenceInstrument,
    ReferenceQuote,
    ReferenceSnapshot,
)
from ..retention import HourlyRollup, RawRow, RollupKey, SourceKind
from ..settings import ChartConfigEntry

_INSERT_QUOTE = """
insert into quotes
    (platform_slug, instrument, side, price_toman, raw_value, raw_scale,
     fetched_at, suppressed)
values ($1, $2, $3, $4, $5, $6, $7, $8)
"""

_INSERT_TERMS = """
insert into platform_terms
    (platform_slug, buy_fee_percent, sell_fee_percent, round_trip_percent,
     fee_source, buy_enabled, sell_enabled, observed_at)
values ($1, $2, $3, $4, $5, $6, $7, $8)
"""

_SELECT_LATEST_FETCHED_AT = """
select max(fetched_at) as fetched_at from quotes
where platform_slug = $1 and not suppressed
"""

_SELECT_QUOTES_AT = """
select platform_slug, instrument, side, price_toman, raw_value, raw_scale, fetched_at
from quotes
where platform_slug = $1 and fetched_at = $2 and not suppressed
"""

_UPSERT_PLATFORM = """
insert into platforms (slug, name_fa, data_policy, market_model, is_listed)
values ($1, $2, $3, $4, $5)
on conflict (slug) do update
    set name_fa = excluded.name_fa,
        data_policy = excluded.data_policy,
        market_model = excluded.market_model,
        is_listed = excluded.is_listed
"""

_SELECT_LISTED_PLATFORMS = """
select slug, name_fa, data_policy, market_model
from platforms where is_listed order by slug
"""


def platform_from_listed_row(row: Any) -> Platform:
    registry = PLATFORM_BY_SLUG.get(row["slug"])
    if registry is not None:
        return registry
    return Platform(
        slug=row["slug"],
        name_fa=row["name_fa"],
        data_policy=DataPolicy(row["data_policy"]),
        market_model=MarketModel(row["market_model"]),
    )

_SELECT_LATEST_TERMS = """
select platform_slug, buy_fee_percent, sell_fee_percent, round_trip_percent,
       fee_source, buy_enabled, sell_enabled, observed_at
from platform_terms
where platform_slug = $1
order by observed_at desc
limit 1
"""

_INSERT_REFERENCE_QUOTE = """
insert into reference_quotes
    (reference_slug, name_fa, source_url, instrument, side, value,
     raw_value, raw_scale, fetched_at)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
"""

_SELECT_LATEST_REFERENCE_FETCHED_AT = """
select max(fetched_at) as fetched_at from reference_quotes
where reference_slug = $1
"""

_SELECT_REFERENCE_QUOTES_AT = """
select reference_slug, name_fa, source_url, instrument, side, value,
       raw_value, raw_scale, fetched_at
from reference_quotes
where reference_slug = $1 and fetched_at = $2
"""

_SELECT_RAW_QUOTE_ROWS = """
select id, platform_slug, instrument, side, price_toman, raw_value, raw_scale,
       fetched_at, suppressed
from quotes
where fetched_at < $1 and ($2::timestamptz is null or fetched_at >= $2)
"""

_SELECT_RAW_REFERENCE_ROWS = """
select id, reference_slug, instrument, side, value, raw_value, raw_scale, fetched_at
from reference_quotes
where fetched_at < $1 and ($2::timestamptz is null or fetched_at >= $2)
"""

_SELECT_LATEST_ROLLUP_HOUR = """
select max(hour_start) as hour_start from hourly_rollups
"""

_SELECT_ROLLUP_KEYS = """
select kind, source_slug, instrument, side, hour_start
from hourly_rollups
where hour_start < $1 and ($2::timestamptz is null or hour_start >= $2)
"""

_UPSERT_ROLLUP = """
insert into hourly_rollups
    (kind, source_slug, instrument, side, hour_start,
     open_value, close_value, min_value, max_value, sample_count)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
on conflict (kind, source_slug, instrument, side, hour_start) do update
    set open_value = excluded.open_value,
        close_value = excluded.close_value,
        min_value = excluded.min_value,
        max_value = excluded.max_value,
        sample_count = excluded.sample_count
"""

_DELETE_QUOTE_ROWS = """
delete from quotes where id = any($1::bigint[])
"""

_DELETE_REFERENCE_ROWS = """
delete from reference_quotes where id = any($1::bigint[])
"""

_SELECT_ROLLUPS = """
select kind, source_slug, instrument, side, hour_start,
       open_value, close_value, min_value, max_value, sample_count
from hourly_rollups
where kind = $1 and source_slug = $2
  and ($3::text is null or instrument = $3)
  and ($4::timestamptz is null or hour_start >= $4)
  and ($5::timestamptz is null or hour_start < $5)
order by hour_start, instrument, side
"""


class PostgresStore:
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    _INSERT_QUOTE,
                    [
                        (
                            q.platform_slug,
                            q.instrument.value,
                            q.side.value,
                            q.price_toman,
                            q.raw_value,
                            q.raw_scale,
                            q.fetched_at,
                            snapshot.suppressed,
                        )
                        for q in snapshot.quotes
                    ],
                )
                terms = snapshot.terms
                await conn.execute(
                    _INSERT_TERMS,
                    terms.platform_slug,
                    terms.buy_fee_percent,
                    terms.sell_fee_percent,
                    terms.round_trip_percent,
                    terms.fee_source.value,
                    terms.buy_enabled,
                    terms.sell_enabled,
                    terms.observed_at,
                )

    async def get_snapshot(self, platform_slug: str) -> PlatformSnapshot | None:
        async with self._pool.acquire() as conn:
            latest = await conn.fetchrow(_SELECT_LATEST_FETCHED_AT, platform_slug)
            if latest is None or latest["fetched_at"] is None:
                return None
            fetched_at: datetime = latest["fetched_at"]
            quote_rows = await conn.fetch(_SELECT_QUOTES_AT, platform_slug, fetched_at)
            terms_row = await conn.fetchrow(_SELECT_LATEST_TERMS, platform_slug)
        if not quote_rows or terms_row is None:
            return None
        return PlatformSnapshot(
            platform_slug=platform_slug,
            quotes=tuple(
                Quote(
                    platform_slug=row["platform_slug"],
                    instrument=Instrument(row["instrument"]),
                    side=Side(row["side"]),
                    price_toman=int(row["price_toman"]),
                    raw_value=row["raw_value"],
                    raw_scale=row["raw_scale"],
                    fetched_at=row["fetched_at"],
                )
                for row in quote_rows
            ),
            terms=PlatformTerms(
                platform_slug=terms_row["platform_slug"],
                buy_fee_percent=terms_row["buy_fee_percent"],
                sell_fee_percent=terms_row["sell_fee_percent"],
                round_trip_percent=terms_row["round_trip_percent"],
                fee_source=FeeSource(terms_row["fee_source"]),
                buy_enabled=terms_row["buy_enabled"],
                sell_enabled=terms_row["sell_enabled"],
                observed_at=terms_row["observed_at"],
            ),
            fetched_at=fetched_at,
        )

    async def get_updated_at(self, platform_slug: str) -> datetime | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(_SELECT_LATEST_FETCHED_AT, platform_slug)
        if row is None:
            return None
        return row["fetched_at"]

    async def save_platforms(self, platforms: Sequence[Platform]) -> None:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    _UPSERT_PLATFORM,
                    [
                        (
                            p.slug,
                            p.name_fa,
                            p.data_policy.value,
                            p.market_model.value,
                            p.is_listed,
                        )
                        for p in platforms
                    ],
                )

    async def get_listed_platforms(self) -> tuple[Platform, ...]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(_SELECT_LISTED_PLATFORMS)
        return tuple(
            sorted(
                (platform_from_listed_row(row) for row in rows),
                key=lambda p: registry_order(p.slug),
            )
        )

    async def save_instruments(self, listings: Sequence[InstrumentListing]) -> None:
        pass

    async def get_instruments(self) -> tuple[InstrumentListing, ...]:
        return ()

    async def save_reference(self, snapshot: ReferenceSnapshot) -> None:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    _INSERT_REFERENCE_QUOTE,
                    [
                        (
                            q.reference_slug,
                            snapshot.name_fa,
                            snapshot.source_url,
                            q.instrument.value,
                            q.side.value,
                            q.value,
                            q.raw_value,
                            q.raw_scale,
                            q.fetched_at,
                        )
                        for q in snapshot.quotes
                    ],
                )

    async def save_chart_config(self, entries: Sequence[ChartConfigEntry]) -> None:
        pass

    async def get_chart_config(self) -> tuple[ChartConfigEntry, ...]:
        return ()

    async def get_reference(self, reference_slug: str) -> ReferenceSnapshot | None:
        async with self._pool.acquire() as conn:
            latest = await conn.fetchrow(_SELECT_LATEST_REFERENCE_FETCHED_AT, reference_slug)
            if latest is None or latest["fetched_at"] is None:
                return None
            fetched_at: datetime = latest["fetched_at"]
            rows = await conn.fetch(_SELECT_REFERENCE_QUOTES_AT, reference_slug, fetched_at)
        if not rows:
            return None
        return ReferenceSnapshot(
            reference_slug=reference_slug,
            name_fa=rows[0]["name_fa"],
            source_url=rows[0]["source_url"],
            quotes=tuple(
                ReferenceQuote(
                    reference_slug=row["reference_slug"],
                    instrument=ReferenceInstrument(row["instrument"]),
                    side=Side(row["side"]),
                    value=row["value"],
                    raw_value=row["raw_value"],
                    raw_scale=row["raw_scale"],
                    fetched_at=row["fetched_at"],
                )
                for row in rows
            ),
            fetched_at=fetched_at,
        )


    async def load_raw_rows(
        self, *, until: datetime, since: datetime | None = None
    ) -> tuple[RawRow, ...]:
        async with self._pool.acquire() as conn:
            quote_rows = await conn.fetch(_SELECT_RAW_QUOTE_ROWS, until, since)
            reference_rows = await conn.fetch(_SELECT_RAW_REFERENCE_ROWS, until, since)
        return tuple(
            RawRow(
                row_id=row["id"],
                kind=SourceKind.PLATFORM,
                source_slug=row["platform_slug"],
                instrument=row["instrument"],
                side=row["side"],
                value=row["price_toman"],
                raw_value=row["raw_value"],
                raw_scale=row["raw_scale"],
                fetched_at=row["fetched_at"],
                suppressed=row["suppressed"],
            )
            for row in quote_rows
        ) + tuple(
            RawRow(
                row_id=row["id"],
                kind=SourceKind.REFERENCE,
                source_slug=row["reference_slug"],
                instrument=row["instrument"],
                side=row["side"],
                value=row["value"],
                raw_value=row["raw_value"],
                raw_scale=row["raw_scale"],
                fetched_at=row["fetched_at"],
            )
            for row in reference_rows
        )

    async def latest_rollup_hour(self) -> datetime | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(_SELECT_LATEST_ROLLUP_HOUR)
        if row is None:
            return None
        return row["hour_start"]

    async def load_rollup_keys(
        self, *, until: datetime, since: datetime | None = None
    ) -> frozenset[RollupKey]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(_SELECT_ROLLUP_KEYS, until, since)
        return frozenset(
            RollupKey(
                SourceKind(row["kind"]),
                row["source_slug"],
                row["instrument"],
                row["side"],
                row["hour_start"],
            )
            for row in rows
        )

    async def upsert_rollups(self, rollups: Sequence[HourlyRollup]) -> None:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    _UPSERT_ROLLUP,
                    [
                        (
                            r.kind.value,
                            r.source_slug,
                            r.instrument,
                            r.side,
                            r.hour_start,
                            r.open_value,
                            r.close_value,
                            r.min_value,
                            r.max_value,
                            r.sample_count,
                        )
                        for r in rollups
                    ],
                )

    async def delete_raw_rows(self, rows: Sequence[RawRow]) -> None:
        quote_ids = [r.row_id for r in rows if r.kind is SourceKind.PLATFORM]
        reference_ids = [r.row_id for r in rows if r.kind is SourceKind.REFERENCE]
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                if quote_ids:
                    await conn.execute(_DELETE_QUOTE_ROWS, quote_ids)
                if reference_ids:
                    await conn.execute(_DELETE_REFERENCE_ROWS, reference_ids)

    async def get_hourly_rollups(
        self,
        kind: SourceKind,
        source_slug: str,
        instrument: str | None = None,
        *,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[HourlyRollup, ...]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                _SELECT_ROLLUPS, kind.value, source_slug, instrument, since, until
            )
        return tuple(
            HourlyRollup(
                kind=SourceKind(row["kind"]),
                source_slug=row["source_slug"],
                instrument=row["instrument"],
                side=row["side"],
                hour_start=row["hour_start"],
                open_value=row["open_value"],
                close_value=row["close_value"],
                min_value=row["min_value"],
                max_value=row["max_value"],
                sample_count=row["sample_count"],
            )
            for row in rows
        )
