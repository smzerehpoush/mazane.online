"""مرز گردآورنده: payload ضبط‌شده‌ی طلاسی ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/talasea_gold_price.json` پاسخ واقعی
`GET https://api.talasea.ir/api/market/getGoldPrice` است (ضبط‌شده ۲۰۲۶-۰۸-۰۶
با User-Agent صادق). تست‌ها هیچ تماس شبکه‌ای ندارند.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.adapters.talasea import TALASEA_ENDPOINT, TalaseaAdapter
from mazane_collector.models import FeeSource, Instrument, Side
from mazane_collector.pipeline import AdapterError, collect_once
from mazane_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "talasea_gold_price.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == TALASEA_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_explicit_x1000_scale() -> None:
    store = InMemoryStore()

    await collect_once(TalaseaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("talasea")
    assert stored is not None
    assert stored.platform_slug == "talasea"
    assert stored.suppressed is False

    by_side = {quote.side: quote for quote in stored.quotes}
    # سکوی دوقیمتی ⟸ سطر MEAN هم دارد: قیمت مرجع خودِ همین سکو، میانگین
    # دو سمت خودش (نه میانگین بین‌سکویی). سازنده‌اش خود مدل است نه آداپتر.
    assert set(by_side) == {Side.MID, Side.BUY, Side.SELL, Side.MEAN}

    # مقدار خام و ضریب صریح آداپتر — طلاسی تومان بر میلی‌گرم، ×۱۰۰۰
    # (سند تحقیق ۰۱، بند ۳.۳).
    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        assert quote.raw_value == Decimal("18530")
        assert quote.raw_scale == Decimal("1000")
        assert quote.fetched_at == FETCHED_AT

    # ریاضی مقیاس: 18530 × 1000 = 18,530,000 تومان بر گرم.
    assert by_side[Side.MID].price_toman == 18530000
    # مشتق‌ها فقط در گردآورنده: fee = 0.01 از خود API.
    assert by_side[Side.BUY].price_toman == 18715300  # 18530000 × 1.01
    assert by_side[Side.SELL].price_toman == 18344700  # 18530000 × 0.99


async def test_terms_fee_comes_from_api_with_status_flags() -> None:
    store = InMemoryStore()

    await collect_once(TalaseaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("talasea")
    assert stored is not None
    terms = stored.terms

    assert terms.buy_fee_percent == Decimal("1")  # fee: 0.01 → درصد
    assert terms.sell_fee_percent == Decimal("1")
    assert terms.fee_source == FeeSource.API
    # disableBuy / disableSell در فیکسچر false هستند ⟸ هر دو سمت باز.
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True
    assert terms.round_trip_percent == Decimal("1.9802")  # 1 − 0.99/1.01


async def test_disable_flags_map_to_enabled_false() -> None:
    payload = load_fixture()
    payload["disableBuy"] = True
    payload["disableSell"] = True
    store = InMemoryStore()

    await collect_once(TalaseaAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    stored = await store.get_snapshot("talasea")
    assert stored is not None
    assert stored.terms.buy_enabled is False
    assert stored.terms.sell_enabled is False


async def test_missing_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["price"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(TalaseaAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("talasea") is None
    assert await store.get_updated_at("talasea") is None
