import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.technogold import TECHNOGOLD_ENDPOINT, TechnogoldAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "technogold_only_price.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == TECHNOGOLD_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_user_view_side_mapping() -> None:
    store = InMemoryStore()

    await collect_once(TechnogoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("technogold")
    assert stored is not None
    assert stored.platform_slug == "technogold"
    assert stored.suppressed is False

    (price,) = stored.quotes
    assert price.side is Side.PRICE

    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        assert quote.raw_scale == Decimal("1")
        assert quote.fetched_at == FETCHED_AT

    assert price.price_toman == 18499847

    assert price.raw_value == Decimal("18499846.5")


async def test_terms_are_implied_from_dealer_spread_as_implied() -> None:
    store = InMemoryStore()

    await collect_once(TechnogoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("technogold")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.IMPLIED
    assert terms.buy_fee_percent == Decimal("0.6258")
    assert terms.sell_fee_percent == Decimal("0.6258")
    assert terms.round_trip_percent == Decimal("1.2438")
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True
    assert terms.observed_at == FETCHED_AT


async def test_missing_prices_raise_and_store_nothing() -> None:
    payload = load_fixture()
    payload["results"]["buy_price"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(TechnogoldAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("technogold") is None
    assert await store.get_updated_at("technogold") is None


async def test_payload_without_results_raises() -> None:
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(
            TechnogoldAdapter(), make_fetcher({"succeed": False}), store, now=FETCHED_AT
        )

    assert await store.get_snapshot("technogold") is None
