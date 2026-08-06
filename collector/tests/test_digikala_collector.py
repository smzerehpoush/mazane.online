"""مرز گردآورنده: payload ضبط‌شده‌ی دیجی‌کالا ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/digikala_prices.json` پاسخ واقعی
`GET https://api.digikala.com/non-inventory/v1/prices/` است (ضبط‌شده
۲۰۲۶-۰۸-۰۶ با User-Agent صادق). تست‌ها هیچ تماس شبکه‌ای ندارند.

دیجی‌کالا فقط یک قیمت می‌دهد و کارمزدش را **عمداً** منتشر نمی‌کند
(سند تحقیق ۰۱، بند ۸.۱: «متغیر است و ممکن است تغییر کند») ⟸
`fee_source = UNKNOWN`: فقط MID، بدون عدد حدسی — «یک ردیف صادقانه با
نامشخص بهتر از یک عدد ساختگی است».
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.adapters.digikala import DIGIKALA_ENDPOINT, DigikalaAdapter
from mazane_collector.models import FeeSource, Instrument, Side
from mazane_collector.pipeline import AdapterError, collect_once
from mazane_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "digikala_prices.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == DIGIKALA_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_stores_only_mid_with_x100_scale() -> None:
    store = InMemoryStore()

    await collect_once(DigikalaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("digikala")
    assert stored is not None
    assert stored.platform_slug == "digikala"

    # کارمزد نامعلوم ⟸ فقط MID و سطر MEAN که بازتاب همان تک‌عدد است
    # (سکوی تک‌قیمتی: عددی که منتشر می‌کند قیمت مرجع اوست). قیمت مؤثر
    # همچنان جعل نمی‌شود — نه BUY هست نه SELL.
    assert [quote.side for quote in stored.quotes] == [Side.MID, Side.MEAN]

    mid, mean = stored.quotes
    # سطر MEAN بازتاب بی‌کم‌وکاست همان MID است — نه گردی تازه‌ای، نه ضریبی.
    assert (mean.price_toman, mean.raw_value, mean.raw_scale, mean.fetched_at) == (
        mid.price_toman,
        mid.raw_value,
        mid.raw_scale,
        mid.fetched_at,
    )
    assert mid.instrument == Instrument.GOLD_18K
    # ضریب صریح این منبع: ریال ÷۱۰۰۰، ×۱۰۰ به تومان بر گرم
    # (سند تحقیق ۰۱، بند ۳.۳ — همان مقیاس میلی).
    assert mid.raw_scale == Decimal("100")
    assert mid.raw_value == Decimal("185946")
    # ریاضی مقیاس: 185946 × 100 = 18,594,600 تومان بر گرم.
    assert mid.price_toman == 18594600


async def test_terms_carry_unknown_fee_without_fabricated_numbers() -> None:
    store = InMemoryStore()

    await collect_once(DigikalaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("digikala")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.UNKNOWN
    assert terms.buy_fee_percent is None
    assert terms.sell_fee_percent is None
    assert terms.round_trip_percent is None
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True


async def test_missing_gold18_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    del payload["gold18"]
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(DigikalaAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("digikala") is None
    assert await store.get_updated_at("digikala") is None


async def test_null_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["gold18"]["price"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(DigikalaAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("digikala") is None
