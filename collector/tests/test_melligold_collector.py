"""مرز گردآورنده: payload ضبط‌شده‌ی ملی‌گلد ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/melligold_buy_sell_price.json` پاسخ واقعی
`GET https://melligold.com/api/v1/exchange/buy-sell-price/?format=json` است
(ضبط‌شده ۲۰۲۶-۰۸-۰۶ با User-Agent صادق و cookie jar — دست‌دهی ArvanCloud،
نه احراز هویت؛ سند تحقیق ۰۱، بند ۸.۲). تست‌ها هیچ تماس شبکه‌ای ندارند.

ملی‌گلد اسپرد صفر می‌دهد (`price_buy == price_sell`) و کارمزدش را جدا
می‌گیرد ولی هیچ‌جا منتشر نکرده ⟸ `fee_source = UNKNOWN`: فقط MID ذخیره
می‌شود و قیمت مؤثر جعل نمی‌شود.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.adapters.melligold import MELLIGOLD_ENDPOINT, MelligoldAdapter
from mazane_collector.models import FeeSource, Instrument, Side
from mazane_collector.pipeline import AdapterError, collect_once
from mazane_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "melligold_buy_sell_price.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == MELLIGOLD_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_stores_only_mid_with_x1_scale() -> None:
    store = InMemoryStore()

    await collect_once(MelligoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("melligold")
    assert stored is not None
    assert stored.platform_slug == "melligold"

    # کارمزد نامعلوم ⟸ قیمت مؤثر BUY/SELL جعل نمی‌شود: فقط MID.
    assert [quote.side for quote in stored.quotes] == [Side.MID]

    (mid,) = stored.quotes
    assert mid.instrument == Instrument.GOLD_18K
    # ضریب صریح این منبع: تومان بر گرم، ×۱ (سند تحقیق ۰۱، بند ۳.۳).
    assert mid.raw_scale == Decimal("1")
    # اسپرد صفر: mid = میانگین price_buy و price_sell (هر دو 18506373).
    assert mid.raw_value == Decimal("18506373")
    assert mid.price_toman == 18506373
    assert mid.fetched_at == FETCHED_AT


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
