from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from ..models import (
    FeeSource,
    Instrument,
    PlatformSnapshot,
    PlatformTerms,
    Quote,
    Side,
)
from ..pricing import (
    ask_bid,
    fee_percent,
    implied_side_fee,
    mean_of_pair,
    round_trip_percent,
    to_toman,
)

_ZERO = Decimal("0")


def _price_quote(
    *,
    slug: str,
    raw_value: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    instrument: Instrument = Instrument.GOLD_18K,
) -> Quote:
    return Quote(
        platform_slug=slug,
        instrument=instrument,
        side=Side.PRICE,
        price_toman=to_toman(raw_value * scale),
        raw_value=raw_value,
        raw_scale=scale,
        fetched_at=fetched_at,
    )


def _snapshot(
    *,
    slug: str,
    raw_value: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    buy_fee: Decimal | None,
    sell_fee: Decimal | None,
    fee_source: FeeSource,
    buy_enabled: bool,
    sell_enabled: bool,
    instrument: Instrument = Instrument.GOLD_18K,
    observed_at: datetime | None = None,
) -> PlatformSnapshot:
    if (buy_fee is None) != (sell_fee is None):
        raise ValueError(f"{slug}: a one-sided fee means a bug — either both, or neither")

    fees: tuple[Decimal, Decimal, Decimal] | None = (
        None
        if buy_fee is None or sell_fee is None
        else (
            fee_percent(buy_fee),
            fee_percent(sell_fee),
            round_trip_percent(buy_fee, sell_fee),
        )
    )

    terms = PlatformTerms(
        platform_slug=slug,
        buy_fee_percent=None if fees is None else fees[0],
        sell_fee_percent=None if fees is None else fees[1],
        round_trip_percent=None if fees is None else fees[2],
        fee_source=fee_source,
        buy_enabled=buy_enabled,
        sell_enabled=sell_enabled,
        observed_at=observed_at if observed_at is not None else fetched_at,
    )
    return PlatformSnapshot(
        platform_slug=slug,
        quotes=(
            _price_quote(
                slug=slug,
                raw_value=raw_value,
                scale=scale,
                fetched_at=fetched_at,
                instrument=instrument,
            ),
        ),
        terms=terms,
        fetched_at=fetched_at,
    )


def dealer_snapshot(
    *,
    slug: str,
    raw_first: Decimal,
    raw_second: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    buy_enabled: bool = True,
    sell_enabled: bool = True,
) -> PlatformSnapshot:
    raw_ask, raw_bid = ask_bid(raw_first, raw_second)
    fee = implied_side_fee(raw_ask, raw_bid)
    return _snapshot(
        slug=slug,
        raw_value=mean_of_pair(raw_ask, raw_bid),
        scale=scale,
        fetched_at=fetched_at,
        buy_fee=fee,
        sell_fee=fee,
        fee_source=FeeSource.IMPLIED,
        buy_enabled=buy_enabled,
        sell_enabled=sell_enabled,
    )


def order_book_snapshot(
    *,
    slug: str,
    raw_first: Decimal,
    raw_second: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    observed_at: datetime | None = None,
) -> PlatformSnapshot:
    raw_ask, raw_bid = ask_bid(raw_first, raw_second)
    return _snapshot(
        slug=slug,
        raw_value=mean_of_pair(raw_ask, raw_bid),
        scale=scale,
        fetched_at=fetched_at,
        buy_fee=_ZERO,
        sell_fee=_ZERO,
        fee_source=FeeSource.MANUAL,
        buy_enabled=True,
        sell_enabled=True,
        observed_at=observed_at,
    )


def known_fee_snapshot(
    *,
    slug: str,
    raw_price: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    buy_fee: Decimal,
    sell_fee: Decimal,
    fee_source: FeeSource,
    buy_enabled: bool = True,
    sell_enabled: bool = True,
    observed_at: datetime | None = None,
) -> PlatformSnapshot:
    return _snapshot(
        slug=slug,
        raw_value=raw_price,
        scale=scale,
        fetched_at=fetched_at,
        buy_fee=buy_fee,
        sell_fee=sell_fee,
        fee_source=fee_source,
        buy_enabled=buy_enabled,
        sell_enabled=sell_enabled,
        observed_at=observed_at,
    )


def unknown_fee_snapshot(
    *,
    slug: str,
    raw_price: Decimal,
    scale: Decimal,
    fetched_at: datetime,
) -> PlatformSnapshot:
    return _snapshot(
        slug=slug,
        raw_value=raw_price,
        scale=scale,
        fetched_at=fetched_at,
        buy_fee=None,
        sell_fee=None,
        fee_source=FeeSource.UNKNOWN,
        buy_enabled=True,
        sell_enabled=True,
    )
