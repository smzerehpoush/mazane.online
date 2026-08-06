"""استور پستگرس — تاریخچه (درج، بدون هرس؛ آرشیو الزام حقوقی است — بند ۷.۱).

اسکیمای جدول‌ها: `collector/migrations/001_init.sql`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from ..models import FeeSource, Instrument, PlatformSnapshot, PlatformTerms, Quote, Side

_INSERT_QUOTE = """
insert into quotes
    (platform_slug, instrument, side, price_toman, raw_value, raw_scale, fetched_at)
values ($1, $2, $3, $4, $5, $6, $7)
"""

_INSERT_TERMS = """
insert into platform_terms
    (platform_slug, buy_fee_percent, sell_fee_percent, round_trip_percent,
     fee_source, buy_enabled, sell_enabled, observed_at)
values ($1, $2, $3, $4, $5, $6, $7, $8)
"""

_SELECT_LATEST_FETCHED_AT = """
select max(fetched_at) as fetched_at from quotes where platform_slug = $1
"""

_SELECT_QUOTES_AT = """
select platform_slug, instrument, side, price_toman, raw_value, raw_scale, fetched_at
from quotes
where platform_slug = $1 and fetched_at = $2
"""

_SELECT_LATEST_TERMS = """
select platform_slug, buy_fee_percent, sell_fee_percent, round_trip_percent,
       fee_source, buy_enabled, sell_enabled, observed_at
from platform_terms
where platform_slug = $1
order by observed_at desc
limit 1
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
