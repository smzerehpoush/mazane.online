import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.tlyn import TLYN_ENDPOINT, TlynAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "tlyn_price.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def gold18(payload: Any) -> dict[str, Any]:
    return next(p for p in payload["prices"] if p["symbol"] == "GOLD18")


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == TLYN_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_x1000_scale_and_inverted_sides() -> None:
    store = InMemoryStore()

    await collect_once(TlynAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("tlyn")
    assert stored is not None
    assert stored.platform_slug == "tlyn"

    (price,) = stored.quotes
    assert price.side is Side.PRICE

    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        assert quote.raw_scale == Decimal("1000")

    fixture_price = gold18(load_fixture())["price"]
    assert price.price_toman == 18525000
    assert price.raw_value == Decimal("18525")


async def test_terms_are_implied_from_spread_with_status_flag() -> None:
    store = InMemoryStore()

    await collect_once(TlynAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("tlyn")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.IMPLIED
    assert terms.buy_fee_percent == Decimal("0.3995")
    assert terms.sell_fee_percent == Decimal("0.3995")
    assert terms.round_trip_percent == Decimal("0.7957")
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True


async def test_disabled_status_maps_to_both_sides_closed() -> None:
    payload = load_fixture()
    gold18(payload)["status"] = "disabled"
    store = InMemoryStore()

    await collect_once(TlynAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    stored = await store.get_snapshot("tlyn")
    assert stored is not None
    assert stored.terms.buy_enabled is False
    assert stored.terms.sell_enabled is False


async def test_missing_gold18_symbol_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["prices"] = [p for p in payload["prices"] if p["symbol"] != "GOLD18"]
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(TlynAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("tlyn") is None
    assert await store.get_updated_at("tlyn") is None


async def test_null_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    gold18(payload)["price"]["sell"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(TlynAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("tlyn") is None
