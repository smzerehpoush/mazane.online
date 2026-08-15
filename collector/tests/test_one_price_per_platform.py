import json
from datetime import UTC, datetime
from decimal import Decimal
from functools import partial

import pytest

from tablo_collector.adapters.common import (
    dealer_snapshot,
    known_fee_snapshot,
    order_book_snapshot,
    unknown_fee_snapshot,
)
from tablo_collector.adapters.daric import DaricAdapter
from tablo_collector.models import FeeSource, Instrument, PlatformSnapshot, Quote, Side
from tablo_collector.pipeline import AdapterError, collect_round
from tablo_collector.platforms import PLATFORMS
from tablo_collector.store.memory import InMemoryStore

from test_full_roster_round import ALL_ADAPTERS, LISTED_SLUGS, make_fetcher

FETCHED_AT = datetime(2026, 8, 10, 9, 30, 0, tzinfo=UTC)


async def test_every_platform_stores_exactly_one_price_row() -> None:
    store = InMemoryStore()
    await collect_round(
        ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT
    )

    for slug in LISTED_SLUGS:
        snapshot = await store.get_snapshot(slug)
        assert snapshot is not None, slug
        assert [q.side for q in snapshot.quotes] == [Side.PRICE], slug
        assert snapshot.quotes[0].platform_slug == slug


def test_two_sided_source_price_is_mean_of_its_own_two_numbers() -> None:
    snapshot = dealer_snapshot(
        slug="ecogold",
        raw_first=Decimal("18436000"),
        raw_second=Decimal("18398000"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )
    assert [q.price_toman for q in snapshot.quotes] == [18417000]
    assert snapshot.terms.fee_source is FeeSource.IMPLIED
    assert snapshot.terms.buy_fee_percent == snapshot.terms.sell_fee_percent


def test_field_order_of_two_sided_source_does_not_change_the_price() -> None:
    same_inputs = partial(dealer_snapshot, slug="tlyn", scale=Decimal("1"), fetched_at=FETCHED_AT)
    forward = same_inputs(raw_first=Decimal("100"), raw_second=Decimal("90"))
    reversed_ = same_inputs(raw_first=Decimal("90"), raw_second=Decimal("100"))
    assert forward.quotes[0].price_toman == reversed_.quotes[0].price_toman
    assert forward.terms.buy_fee_percent == reversed_.terms.buy_fee_percent


def test_fee_is_never_multiplied_into_the_price() -> None:
    snapshot = known_fee_snapshot(
        slug="wallgold",
        raw_price=Decimal("18611000"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
        buy_fee=Decimal("0.005"),
        sell_fee=Decimal("0.005"),
        fee_source=FeeSource.API,
    )
    assert snapshot.quotes[0].price_toman == 18611000
    assert snapshot.terms.buy_fee_percent == Decimal("0.5000")
    assert snapshot.terms.round_trip_percent == Decimal("0.9950")


def test_asymmetric_fees_are_kept_apart() -> None:
    snapshot = known_fee_snapshot(
        slug="goldika",
        raw_price=Decimal("18500000"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
        buy_fee=Decimal("0.004"),
        sell_fee=Decimal("0.009"),
        fee_source=FeeSource.API,
    )
    assert snapshot.terms.buy_fee_percent == Decimal("0.4000")
    assert snapshot.terms.sell_fee_percent == Decimal("0.9000")


def test_unknown_fee_is_null_not_zero() -> None:
    snapshot = unknown_fee_snapshot(
        slug="melligold",
        raw_price=Decimal("18520000"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )
    assert snapshot.terms.fee_source is FeeSource.UNKNOWN
    assert snapshot.terms.buy_fee_percent is None
    assert snapshot.terms.sell_fee_percent is None
    assert snapshot.terms.round_trip_percent is None
    assert snapshot.quotes[0].price_toman == 18520000


def test_order_book_price_is_book_mean_with_zero_fee() -> None:
    payload = {"bestBuy": {"price": 18646034.0}, "bestSell": {"price": 18678973.0}}
    snapshot = DaricAdapter().parse(payload, FETCHED_AT)
    assert snapshot.quotes[0].price_toman == 18662504
    assert snapshot.terms.fee_source is FeeSource.MANUAL
    assert snapshot.terms.buy_fee_percent == Decimal("0.0000")
    assert snapshot.terms.sell_fee_percent == Decimal("0.0000")
    assert snapshot.terms.round_trip_percent == Decimal("0.0000")


@pytest.mark.parametrize(
    "payload",
    [
        {"bestBuy": {"price": 18646034.0}, "bestSell": None},
        {"bestBuy": None, "bestSell": {"price": 18678973.0}},
        {"bestBuy": None, "bestSell": None},
    ],
)
def test_one_sided_book_has_no_price_at_all(payload: dict) -> None:
    with pytest.raises(AdapterError):
        DaricAdapter().parse(payload, FETCHED_AT)


def test_canonical_json_carries_one_price_and_no_effective_keys() -> None:
    snapshot = order_book_snapshot(
        slug="daric",
        raw_first=Decimal("18646034"),
        raw_second=Decimal("18678973"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )
    payload = json.loads(snapshot.model_dump_json())
    assert [q["side"] for q in payload["quotes"]] == ["PRICE"]
    assert "reference_prices_toman" not in payload


def test_two_rows_for_one_instrument_is_rejected() -> None:
    def row(value: int) -> Quote:
        return Quote(
            platform_slug="wallgold",
            instrument=Instrument.GOLD_18K,
            price_toman=value,
            raw_value=Decimal(value),
            raw_scale=Decimal("1"),
            fetched_at=FETCHED_AT,
        )

    terms = unknown_fee_snapshot(
        slug="wallgold",
        raw_price=Decimal("1"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    ).terms

    with pytest.raises(ValueError, match="one price row"):
        PlatformSnapshot(
            platform_slug="wallgold",
            quotes=(row(1), row(2)),
            terms=terms,
            fetched_at=FETCHED_AT,
        )
