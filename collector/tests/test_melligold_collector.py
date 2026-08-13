import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.melligold import MELLIGOLD_ENDPOINT, MelligoldAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "melligold_buy_sell_price.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == MELLIGOLD_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_stores_one_price_with_x1_scale() -> None:
    store = InMemoryStore()

    await collect_once(MelligoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("melligold")
    assert stored is not None
    assert stored.platform_slug == "melligold"

    assert [quote.side for quote in stored.quotes] == [Side.PRICE]

    (price,) = stored.quotes
    assert price.instrument == Instrument.GOLD_18K
    assert price.raw_scale == Decimal("1")
    assert price.raw_value == Decimal("18506373")
    assert price.price_toman == 18506373
    assert price.fetched_at == FETCHED_AT


async def test_terms_carry_unknown_fee_without_fabricated_numbers() -> None:
    store = InMemoryStore()

    await collect_once(MelligoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("melligold")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.UNKNOWN
    assert terms.buy_fee_percent is None
    assert terms.sell_fee_percent is None
    assert terms.round_trip_percent is None
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True
    assert terms.observed_at == FETCHED_AT


async def test_missing_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["data"]["price_buy"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(MelligoldAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("melligold") is None
    assert await store.get_updated_at("melligold") is None


async def test_payload_without_data_raises() -> None:
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(
            MelligoldAdapter(), make_fetcher({"message": "Success"}), store, now=FETCHED_AT
        )

    assert await store.get_snapshot("melligold") is None
