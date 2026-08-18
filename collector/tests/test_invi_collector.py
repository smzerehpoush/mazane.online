import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.invi import (
    INVI_WS_ENDPOINT,
    InviAdapter,
    decode_invi_message,
)
from tablo_collector.adapters.wallgold import WALLGOLD_ENDPOINT, WallgoldAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once, collect_round
from tablo_collector.platforms import PLATFORMS
from tablo_collector.store.memory import InMemoryStore
from tablo_collector.ws import FeedStale

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads((FIXTURES / "invi_ws_price.json").read_text(encoding="utf-8"))


def decoded_gold_frame() -> Any:
    decoded = decode_invi_message(json.dumps(load_fixture()))
    assert decoded is not None
    return decoded


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == INVI_WS_ENDPOINT
        if isinstance(payload, Exception):
            raise payload
        return payload

    return fetch_json


async def test_fixture_frame_is_stored_mid_only_with_unknown_fee() -> None:
    store = InMemoryStore()

    await collect_once(
        InviAdapter(), make_fetcher(decoded_gold_frame()), store, now=FETCHED_AT
    )

    stored = await store.get_snapshot("invi")
    assert stored is not None
    assert await store.get_updated_at("invi") == FETCHED_AT

    assert [q.side for q in stored.quotes] == [Side.PRICE]
    quote = stored.quotes[0]
    assert quote.instrument == Instrument.GOLD_18K
    assert quote.raw_value == Decimal("185290")
    assert quote.raw_scale == Decimal("100")
    assert quote.price_toman == 18529000

    assert stored.terms.fee_source == FeeSource.UNKNOWN
    assert stored.terms.buy_fee_percent is None
    assert stored.terms.sell_fee_percent is None
    assert stored.terms.round_trip_percent is None


def test_decoder_picks_the_gold_market_out_of_the_full_markets_array() -> None:
    decoded = decode_invi_message(json.dumps(load_fixture()))
    assert decoded is not None
    assert decoded["market"] == "goldirr"
    assert decoded["close"] == "185290"


def test_decoder_ignores_unrelated_frames_instead_of_erroring() -> None:
    assert decode_invi_message("نه-JSON") is None
    assert decode_invi_message(json.dumps({"type": "ping"})) is None
    assert decode_invi_message(json.dumps({"symbol": "SILVER", "price": 1})) is None
    silver_only: dict[str, Any] = {"message": {"markets": [{"market": "slvrirr", "close": "2100"}]}}
    assert decode_invi_message(json.dumps(silver_only)) is None
    empty_markets: dict[str, Any] = {"message": {"markets": []}}
    assert decode_invi_message(json.dumps(empty_markets)) is None
    not_a_list: dict[str, Any] = {"message": {"markets": "goldirr"}}
    assert decode_invi_message(json.dumps(not_a_list)) is None


async def test_null_price_raises_and_stores_nothing() -> None:
    payload = {**decoded_gold_frame(), "close": None}
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(InviAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("invi") is None
    assert await store.get_updated_at("invi") is None


async def test_unexpected_frame_shape_raises_and_stores_nothing() -> None:
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(
            InviAdapter(), make_fetcher({"data": {"gold": 123}}), store, now=FETCHED_AT
        )

    assert await store.get_snapshot("invi") is None


async def test_ws_disconnect_is_staleness_at_the_pipeline_level_not_a_crash() -> None:
    wallgold_payload = json.loads(
        (FIXTURES / "wallgold_markets.json").read_text(encoding="utf-8")
    )
    payloads: dict[str, Any] = {
        WALLGOLD_ENDPOINT: wallgold_payload,
        INVI_WS_ENDPOINT: FeedStale("خوراک اینوی فریم تازه ندارد"),
    }

    async def fetch_json(url: str) -> Any:
        value = payloads[url]
        if isinstance(value, Exception):
            raise value
        return value

    store = InMemoryStore()
    saved = await collect_round(
        (WallgoldAdapter(), InviAdapter()),
        fetch_json,
        store,
        platforms=PLATFORMS,
        now=FETCHED_AT,
    )

    assert {s.platform_slug for s in saved} == {"wallgold"}
    assert await store.get_snapshot("invi") is None
    assert await store.get_updated_at("invi") is None
    assert await store.get_snapshot("wallgold") is not None
    assert "invi" in {p.slug for p in await store.get_listed_platforms()}
