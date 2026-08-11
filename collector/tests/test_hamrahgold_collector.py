"""مرز گردآورنده: payload ضبط‌شده‌ی همراه‌گلد ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/hamrahgold_xau_changes.json` پاسخ واقعی
`GET https://pwa.hamrahgold.com/api/v1/market/price/xau/changes` است
(ضبط‌شده ۲۰۲۶-۰۸-۰۶ با User-Agent صادق؛ بدون هیچ کلیدی — سند تحقیق ۰۱،
بند ۳.۵). تست‌ها هیچ تماس شبکه‌ای ندارند.

همراه‌گلد فقط یک قیمت می‌دهد (`data.current` با `type: "buy"`) و کارمزدی
منتشر نکرده ⟸ `fee_source = UNKNOWN`: فقط MID، بدون قیمت مؤثر جعلی.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.hamrahgold import HAMRAHGOLD_ENDPOINT, HamrahgoldAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "hamrahgold_xau_changes.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == HAMRAHGOLD_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_stores_one_price_with_rial_div10_scale() -> None:
    store = InMemoryStore()

    await collect_once(HamrahgoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("hamrahgold")
    assert stored is not None
    assert stored.platform_slug == "hamrahgold"

    # کارمزد نامعلوم ⟸ فقط MID و سطر MEAN که بازتاب همان تک‌عدد است
    # همچنان جعل نمی‌شود — نه BUY هست نه SELL.
    assert [quote.side for quote in stored.quotes] == [Side.PRICE]

    (price,) = stored.quotes
    assert price.instrument == Instrument.GOLD_18K
    # ضریب صریح این منبع: **ریال** بر گرم، ÷۱۰ به تومان
    # (سند تحقیق ۰۱، بند ۳.۳).
    assert price.raw_scale == Decimal("0.1")
    assert price.raw_value == Decimal("185560000")
    # ریاضی مقیاس: 185560000 ریال ÷ ۱۰ = 18,556,000 تومان بر گرم.
    assert price.price_toman == 18556000


async def test_terms_carry_unknown_fee_without_fabricated_numbers() -> None:
    store = InMemoryStore()

    await collect_once(HamrahgoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("hamrahgold")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.UNKNOWN
    assert terms.buy_fee_percent is None
    assert terms.sell_fee_percent is None
    assert terms.round_trip_percent is None
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True


async def test_missing_current_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["data"]["current"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(HamrahgoldAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("hamrahgold") is None
    assert await store.get_updated_at("hamrahgold") is None


async def test_payload_without_data_raises() -> None:
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(
            HamrahgoldAdapter(), make_fetcher({"success": False}), store, now=FETCHED_AT
        )

    assert await store.get_snapshot("hamrahgold") is None
