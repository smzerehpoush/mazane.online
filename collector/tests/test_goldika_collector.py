"""مرز گردآورنده: payload ضبط‌شده‌ی گلدیکا ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/goldika_v2_price.json` پاسخ واقعی
`GET https://goldika.ir/api/v2/public/price` است (ضبط‌شده ۲۰۲۶-۰۸-۰۶ با
User-Agent صادق). تست‌ها هیچ تماس شبکه‌ای ندارند.

گلدیکا کرال و ذخیره می‌شود ولی `PERMISSION_PENDING` است — نمایش عمومی‌اش در
`test_multi_source_round.py` پوشش داده شده است.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.adapters.goldika import GOLDIKA_ENDPOINT, GoldikaAdapter
from mazane_collector.models import FeeSource, Instrument, Side
from mazane_collector.pipeline import AdapterError, collect_once
from mazane_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "goldika_v2_price.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == GOLDIKA_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_explicit_div10_scale() -> None:
    store = InMemoryStore()

    await collect_once(GoldikaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("goldika")
    assert stored is not None
    assert stored.platform_slug == "goldika"

    by_side = {quote.side: quote for quote in stored.quotes}
    # سکوی دوقیمتی ⟸ سطر MEAN هم دارد: قیمت مرجع خودِ همین سکو، میانگین
    # دو سمت خودش (نه میانگین بین‌سکویی). سازنده‌اش خود مدل است نه آداپتر.
    assert set(by_side) == {Side.MID, Side.BUY, Side.SELL, Side.MEAN}

    # مقدار خام و ضریب صریح آداپتر — گلدیکا ریال بر گرم، ÷۱۰
    # (سند تحقیق ۰۱، بند ۳.۳).
    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        assert quote.raw_value == Decimal("185142350")
        assert quote.raw_scale == Decimal("0.1")

    # ریاضی مقیاس: 185142350 ریال ÷ 10 = 18,514,235 تومان بر گرم.
    assert by_side[Side.MID].price_toman == 18514235
    # کارمزد ۱٫۲٪ از خود API؛ تحقیق تأیید کرد buy = mid × 1.012 دقیقاً —
    # پس این اعداد با old_price.buy/sell خود گلدیکا هم‌خوان‌اند.
    assert by_side[Side.BUY].price_toman == 18736406  # 18514235 × 1.012 گرد
    assert by_side[Side.SELL].price_toman == 18292064  # 18514235 × 0.988 گرد


async def test_terms_commission_comes_from_api() -> None:
    store = InMemoryStore()

    await collect_once(GoldikaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("goldika")
    assert stored is not None
    terms = stored.terms

    assert terms.buy_fee_percent == Decimal("1.2")
    assert terms.sell_fee_percent == Decimal("1.2")
    assert terms.fee_source == FeeSource.API
    assert terms.round_trip_percent == Decimal("2.3715")  # 1 − 0.988/1.012


async def test_missing_mid_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["data"]["mid_price"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(GoldikaAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("goldika") is None
    assert await store.get_updated_at("goldika") is None
