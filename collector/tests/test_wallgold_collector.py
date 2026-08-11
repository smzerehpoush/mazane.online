"""مرز گردآورنده: payload ضبط‌شده‌ی وال‌گلد ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/wallgold_markets.json` پاسخ واقعی
`GET https://api.wallgold.ir/api/v1/markets` است (ضبط‌شده ۲۰۲۶-۰۸-۰۶ با
User-Agent صادق). تست‌ها هیچ تماس شبکه‌ای ندارند.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.wallgold import WALLGOLD_ENDPOINT, WallgoldAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "wallgold_markets.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == WALLGOLD_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_as_one_price_with_raw_scale() -> None:
    store = InMemoryStore()

    await collect_once(WallgoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("wallgold")
    assert stored is not None
    assert stored.platform_slug == "wallgold"
    assert stored.fetched_at == FETCHED_AT

    (price,) = stored.quotes
    # یک سکو، یک سطر — «قیمت»، پیش از کارمزد (سند تصمیم ۰۰۰۲).
    assert price.side is Side.PRICE

    # مقدار خام و ضریب صریح آداپتر — وال‌گلد تومان بر گرم، ×۱ (سند تحقیق ۰۱).
    for quote in stored.quotes:
        assert quote.platform_slug == "wallgold"
        assert quote.instrument == Instrument.GOLD_18K
        assert quote.raw_value == Decimal("18611000")
        assert quote.raw_scale == Decimal("1")
        assert quote.fetched_at == FETCHED_AT
    assert price.price_toman == 18611000


async def test_terms_come_from_api_with_round_trip_computed() -> None:
    store = InMemoryStore()

    await collect_once(WallgoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("wallgold")
    assert stored is not None
    terms = stored.terms

    assert terms.platform_slug == "wallgold"
    assert terms.buy_fee_percent == Decimal("0.5")  # otcFeeCoefficient 0.005 → درصد
    assert terms.sell_fee_percent == Decimal("0.5")
    assert terms.fee_source == FeeSource.API
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True
    # round_trip = 1 − (1−f_sell)/(1+f_buy) → ‏۰٫۹۹۵٪ (گرد به ۴ رقم اعشار)
    assert terms.round_trip_percent == Decimal("0.9950")
    assert terms.observed_at == FETCHED_AT


async def test_updated_at_tracks_successful_collection() -> None:
    store = InMemoryStore()
    assert await store.get_updated_at("wallgold") is None

    await collect_once(WallgoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    assert await store.get_updated_at("wallgold") == FETCHED_AT


async def test_missing_gold_price_raises_and_stores_nothing() -> None:
    """قطع منبع ⟸ کهنگی، نه داده‌ی خراب: payload بی‌قیمت هیچ ردیفی نمی‌نویسد."""
    payload = load_fixture()
    for market in payload["result"]:
        market["marketCap"]["lastPrice"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(WallgoldAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("wallgold") is None
    assert await store.get_updated_at("wallgold") is None
