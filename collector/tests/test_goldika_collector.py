import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.goldika import GOLDIKA_ENDPOINT, GoldikaAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "goldika_v2_price.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == GOLDIKA_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_explicit_div10_scale() -> None:
    store = InMemoryStore()

    await collect_once(GoldikaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("goldika")
    assert stored is not None
    assert stored.platform_slug == "goldika"

    (price,) = stored.quotes
    assert price.side is Side.PRICE

    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        assert quote.raw_value == Decimal("185142350")
        assert quote.raw_scale == Decimal("0.1")

    assert price.price_toman == 18514235


async def test_terms_commission_comes_from_api() -> None:
    store = InMemoryStore()

    await collect_once(GoldikaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("goldika")
    assert stored is not None
    terms = stored.terms

    assert terms.buy_fee_percent == Decimal("1.2")
    assert terms.sell_fee_percent == Decimal("1.2")
    assert terms.fee_source == FeeSource.API
    assert terms.round_trip_percent == Decimal("2.3715")


async def test_missing_mid_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["data"]["mid_price"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(GoldikaAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("goldika") is None
    assert await store.get_updated_at("goldika") is None
