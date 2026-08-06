"""مرز گردآورنده: payload ضبط‌شده‌ی تکنوگلد ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/technogold_only_price.json` پاسخ واقعی
`GET https://api2.technogold.gold/customer/tradeables/only-price/1` است
(ضبط‌شده ۲۰۲۶-۰۸-۰۶ با User-Agent صادق). تست‌ها هیچ تماس شبکه‌ای ندارند.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.adapters.technogold import TECHNOGOLD_ENDPOINT, TechnogoldAdapter
from mazane_collector.models import FeeSource, Instrument, Side
from mazane_collector.pipeline import AdapterError, collect_once
from mazane_collector.store.memory import InMemoryStore

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

    by_side = {quote.side: quote for quote in stored.quotes}
    assert set(by_side) == {Side.MID, Side.BUY, Side.SELL}

    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        # ضریب صریح این منبع: تومان بر گرم، ×۱ (سند تحقیق ۰۱، بند ۳.۳).
        assert quote.raw_scale == Decimal("1")
        assert quote.fetched_at == FETCHED_AT

    # نام‌گذاری تکنوگلد «دید کاربر» است: buy_price بزرگ‌تر = آنچه کاربر
    # می‌پردازد (سند تحقیق ۰۱، بند ۳.۲) ⟸ BUY مؤثر = buy_price خود API.
    assert by_side[Side.BUY].price_toman == 18615615
    assert by_side[Side.SELL].price_toman == 18384078
    # mid = میانگین ask و bid؛ (18615615 + 18384078) / 2 = 18499846.5 → گرد.
    assert by_side[Side.MID].price_toman == 18499847

    # مقدار خام هر سطر همان عدد منبع برای همان سمت است.
    assert by_side[Side.BUY].raw_value == Decimal("18615615")
    assert by_side[Side.SELL].raw_value == Decimal("18384078")
    assert by_side[Side.MID].raw_value == Decimal("18499846.5")


async def test_terms_are_implied_from_dealer_spread_as_api() -> None:
    """کارمزد تکنوگلد در اسپرد خود API است (نه عدد جدا): کارمزد ضمنی هر سمت
    = (ask−bid)/(ask+bid) و رفت‌وبرگشت = 1 − bid/ask ⟸ `fee_source = API`."""
    store = InMemoryStore()

    await collect_once(TechnogoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("technogold")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.API
    assert terms.buy_fee_percent == Decimal("0.6258")
    assert terms.sell_fee_percent == Decimal("0.6258")
    # سند تحقیق ۰۱ (بند ۳.۸) رفت‌وبرگشت تکنوگلد را ~۱٫۲۴٪ اندازه گرفته بود.
    assert terms.round_trip_percent == Decimal("1.2438")
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True
    assert terms.observed_at == FETCHED_AT


async def test_missing_prices_raise_and_store_nothing() -> None:
    """قطع منبع ⟸ کهنگی، نه داده‌ی خراب: payload بی‌قیمت هیچ ردیفی نمی‌نویسد."""
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
