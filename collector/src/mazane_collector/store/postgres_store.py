"""استور پستگرس — تاریخچه (درج، بدون هرس؛ آرشیو الزام حقوقی است — بند ۷.۱).

اسکیمای جدول‌ها: `collector/migrations/001_init.sql` تا `004_references.sql`.
اسنپ‌شات سرکوب‌شده (رد چک میانه) هم درج می‌شود — با `suppressed = true` —
ولی خواندن‌های «جاری» فقط ردیف‌های منتشرشده را می‌بینند. مراجع قیمت
(بند ۱۲.۲) جدول جدای خودشان را دارند و هر ردیفشان نشانی منبع را حمل
می‌کند — عدد مرجع بدون ذکر منبع وجود ندارد (بند ۷.۱).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any

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


class PostgresStore:
    def __init__(self, pool: Any) -> None:
        """`pool` یک `asyncpg.Pool` است (تزریقی، برای تست‌پذیری)."""
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
            Platform(
                slug=row["slug"],
                name_fa=row["name_fa"],
                data_policy=DataPolicy(row["data_policy"]),
                market_model=MarketModel(row["market_model"]),
            )
            for row in rows
        )

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
