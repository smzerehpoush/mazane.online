"""مرز گردآورنده: payload ضبط‌شده‌ی میلی ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/milli_price_external.json` پاسخ واقعی
`GET https://milli.gold/api/v1/public/milli-price/external` است (ضبط‌شده
۲۰۲۶-۰۸-۰۶ با User-Agent صادق). تست‌ها هیچ تماس شبکه‌ای ندارند.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.adapters.milli import (
    MILLI_ENDPOINT,
    MILLI_FEE_OBSERVED_AT,
    MilliAdapter,
)
from mazane_collector.models import FeeSource, Instrument, Side
from mazane_collector.pipeline import AdapterError, collect_once
from mazane_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "milli_price_external.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == MILLI_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_explicit_x100_scale() -> None:
    store = InMemoryStore()

    await collect_once(MilliAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("milli")
    assert stored is not None
    assert stored.platform_slug == "milli"

    by_side = {quote.side: quote for quote in stored.quotes}
    assert set(by_side) == {Side.MID, Side.BUY, Side.SELL}

    # مقدار خام و ضریب صریح آداپتر — میلی ریال بر میلی‌گرم، ×۱۰۰
    # (سند تحقیق ۰۱، بند ۳.۳).
    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        assert quote.raw_value == Decimal("185380")
        assert quote.raw_scale == Decimal("100")

    # ریاضی مقیاس: 185380 × 100 = 18,538,000 تومان بر گرم.
    assert by_side[Side.MID].price_toman == 18538000
    # کارمزد دستی ۰٫۵٪ هر سمت (سند تحقیق ۰۱، بند ۳.۴).
    assert by_side[Side.BUY].price_toman == 18630690  # 18538000 × 1.005
    assert by_side[Side.SELL].price_toman == 18445310  # 18538000 × 0.995


async def test_manual_fee_is_labeled_with_observation_date() -> None:
    """کارمزد میلی از API نمی‌آید: باید MANUAL با تاریخ مشاهده ثبت شود تا UI
    برچسب «دستی» بزند (بند ۲.۲ سند معماری)."""
    store = InMemoryStore()

    await collect_once(MilliAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("milli")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.MANUAL
    assert terms.buy_fee_percent == Decimal("0.5")
    assert terms.sell_fee_percent == Decimal("0.5")
    assert terms.round_trip_percent == Decimal("0.9950")
    # تاریخ مشاهده‌ی عدد دستی — نه زمان کرال.
    assert terms.observed_at == MILLI_FEE_OBSERVED_AT
    assert terms.observed_at != FETCHED_AT


async def test_missing_price18_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["data"]["price18"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(MilliAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("milli") is None
    assert await store.get_updated_at("milli") is None
