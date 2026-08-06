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

from mazane_collector.adapters.baazar import BAAZAR_ENDPOINT, BaazarAdapter
from mazane_collector.models import FeeSource, Instrument, Side
from mazane_collector.pipeline import AdapterError, collect_once
from mazane_collector.store.memory import InMemoryStore

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

    by_side = {quote.side: quote for quote in stored.quotes}
    # سکوی دوقیمتی ⟸ سطر MEAN هم دارد: قیمت مرجع خودِ همین سکو، میانگین
    # دو سمت خودش (نه میانگین بین‌سکویی). سازنده‌اش خود مدل است نه آداپتر.
    assert set(by_side) == {Side.MID, Side.BUY, Side.SELL, Side.MEAN}

    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        # ضریب صریح این منبع: **ریال** بر گرم، ÷۱۰ به تومان
        # (سند تحقیق ۰۱، بند ۳.۳).
        assert quote.raw_scale == Decimal("0.1")

    # نام‌گذاری بازر «دید کاربر» است: buyPrice بزرگ‌تر = آنچه کاربر می‌پردازد.
    # ریاضی مقیاس: 186227358 ریال ÷ ۱۰ = 18,622,735.8 → گرد به 18,622,736.
    assert by_side[Side.BUY].price_toman == 18622736
    assert by_side[Side.SELL].price_toman == 18414969  # 184149694 ÷ 10 → گرد
    assert by_side[Side.MID].price_toman == 18518853

    assert by_side[Side.BUY].raw_value == Decimal("186227358")
    assert by_side[Side.SELL].raw_value == Decimal("184149694")


async def test_terms_are_implied_from_dealer_spread_as_api() -> None:
    store = InMemoryStore()

    await collect_once(BaazarAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("baazar")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.API
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
