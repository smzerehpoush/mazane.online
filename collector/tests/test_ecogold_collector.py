"""مرز گردآورنده: payload ضبط‌شده‌ی اکوگلد ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/ecogold_prices_otc.json` پاسخ واقعی
`GET https://backend.ecogold.ir/api/prices/otc` است (ضبط‌شده ۲۰۲۶-۰۸-۰۶ با
User-Agent صادق). قیمت‌ها رشته‌ی اعشاری‌اند و هر سطر امضای JWT دارد؛ آداپتر
فقط قیمت را می‌خواند. تست‌ها هیچ تماس شبکه‌ای ندارند.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.ecogold import ECOGOLD_ENDPOINT, EcogoldAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "ecogold_prices_otc.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def gold_row(payload: Any) -> dict[str, Any]:
    return next(r for r in payload["data"] if r["symbol"] == "GOLD18-IRT")


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == ECOGOLD_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_user_view_side_mapping() -> None:
    store = InMemoryStore()

    await collect_once(EcogoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("ecogold")
    assert stored is not None
    assert stored.platform_slug == "ecogold"

    (price,) = stored.quotes
    # یک سکو، یک سطر — «قیمت»، پیش از کارمزد (سند تصمیم ۰۰۰۲).
    assert price.side is Side.PRICE

    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        # ضریب صریح این منبع: تومان بر گرم (نمادهای ‎-IRT)، ×۱
        # (سند تحقیق ۰۱، بند ۳.۳).
        assert quote.raw_scale == Decimal("1")

    # نام‌گذاری اکوگلد «دید کاربر» است: buy_price بزرگ‌تر = آنچه کاربر می‌پردازد.
    assert price.price_toman == 18514000


async def test_terms_are_implied_from_dealer_spread_as_implied() -> None:
    store = InMemoryStore()

    await collect_once(EcogoldAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("ecogold")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.IMPLIED
    assert terms.buy_fee_percent == Decimal("0.1026")
    assert terms.sell_fee_percent == Decimal("0.1026")
    # سند تحقیق ۰۱ (بند ۳.۸): اکوگلد ارزان‌ترین رفت‌وبرگشت بازار (~۰٫۲۱٪).
    assert terms.round_trip_percent == Decimal("0.2050")
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True


async def test_missing_gold_symbol_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["data"] = [r for r in payload["data"] if r["symbol"] != "GOLD18-IRT"]
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(EcogoldAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("ecogold") is None
    assert await store.get_updated_at("ecogold") is None


async def test_null_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    gold_row(payload)["buy_price"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(EcogoldAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("ecogold") is None
