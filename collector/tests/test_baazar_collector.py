"""مرز گردآورنده: payload ضبط‌شده‌ی بازر ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/baazar_price_daily.json` پاسخ واقعی
`GET https://api.baazar.ir/landing/v1/price/DAILY/30` است (ضبط‌شده ۲۰۲۶-۰۸-۰۶
با User-Agent صادق؛ آرایه‌ی `data.prices` تاریخچه‌ی ۳۰ روزه است و آداپتر
از آن استفاده نمی‌کند). تست‌ها هیچ تماس شبکه‌ای ندارند.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.baazar import BAAZAR_ENDPOINT, BaazarAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "baazar_price_daily.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == BAAZAR_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_rial_div10_scale() -> None:
    store = InMemoryStore()

    await collect_once(BaazarAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("baazar")
    assert stored is not None
    assert stored.platform_slug == "baazar"

    (price,) = stored.quotes
    # یک سکو، یک سطر — «قیمت»، پیش از کارمزد (سند تصمیم ۰۰۰۲).
    assert price.side is Side.PRICE

    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        # ضریب صریح این منبع: **ریال** بر گرم، ÷۱۰ به تومان
        # (سند تحقیق ۰۱، بند ۳.۳).
        assert quote.raw_scale == Decimal("0.1")

    # نام‌گذاری بازر «دید کاربر» است: buyPrice بزرگ‌تر = آنچه کاربر می‌پردازد.
    # ریاضی مقیاس: 186227358 ریال ÷ ۱۰ = 18,622,735.8 → گرد به 18,622,736.
    assert price.price_toman == 18518853


async def test_terms_are_implied_from_dealer_spread_as_implied() -> None:
    store = InMemoryStore()

    await collect_once(BaazarAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("baazar")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.IMPLIED
    assert terms.buy_fee_percent == Decimal("0.5610")
    assert terms.sell_fee_percent == Decimal("0.5610")
    # سند تحقیق ۰۱ (بند ۳.۸) رفت‌وبرگشت بازر را ~۱٫۱۳٪ اندازه گرفته بود.
    assert terms.round_trip_percent == Decimal("1.1157")
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True


async def test_missing_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["data"]["buyPrice"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(BaazarAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("baazar") is None
    assert await store.get_updated_at("baazar") is None


async def test_payload_without_data_raises() -> None:
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(BaazarAdapter(), make_fetcher([1, 2, 3]), store, now=FETCHED_AT)

    assert await store.get_snapshot("baazar") is None
