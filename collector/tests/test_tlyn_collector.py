"""مرز گردآورنده: payload ضبط‌شده‌ی طلاین ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/tlyn_price.json` پاسخ واقعی
`GET https://price.tlyn.ir/api/v1/price` است (ضبط‌شده ۲۰۲۶-۰۸-۰۶ با
User-Agent صادق). تست‌ها هیچ تماس شبکه‌ای ندارند.

⚠️ نام‌گذاری طلاین «دید فروشنده» است (سند تحقیق ۰۱، بند ۳.۲): فیلد `sell`
بزرگ‌تر است و همان است که کاربر **می‌پردازد**. تست وارونگی سمت‌ها را قفل می‌کند.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.adapters.tlyn import TLYN_ENDPOINT, TlynAdapter
from mazane_collector.models import FeeSource, Instrument, Side
from mazane_collector.pipeline import AdapterError, collect_once
from mazane_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "tlyn_price.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def gold18(payload: Any) -> dict[str, Any]:
    return next(p for p in payload["prices"] if p["symbol"] == "GOLD18")


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == TLYN_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_x1000_scale_and_inverted_sides() -> None:
    store = InMemoryStore()

    await collect_once(TlynAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("tlyn")
    assert stored is not None
    assert stored.platform_slug == "tlyn"

    by_side = {quote.side: quote for quote in stored.quotes}
    assert set(by_side) == {Side.MID, Side.BUY, Side.SELL}

    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        # ضریب صریح این منبع: تومان ÷۱۰۰۰، ×۱۰۰۰ به تومان بر گرم
        # (سند تحقیق ۰۱، بند ۳.۳).
        assert quote.raw_scale == Decimal("1000")

    # وارونگی سمت‌ها: در فیکسچر `price.sell = 18599` و `price.buy = 18451`؛
    # BUY مؤثر (آنچه کاربر می‌پردازد) باید از فیلد **sell** منبع بیاید.
    fixture_price = gold18(load_fixture())["price"]
    assert by_side[Side.BUY].price_toman == fixture_price["sell"] * 1000  # 18,599,000
    assert by_side[Side.SELL].price_toman == fixture_price["buy"] * 1000  # 18,451,000
    assert by_side[Side.MID].price_toman == 18525000

    assert by_side[Side.BUY].raw_value == Decimal("18599")
    assert by_side[Side.SELL].raw_value == Decimal("18451")
    assert by_side[Side.MID].raw_value == Decimal("18525")


async def test_terms_are_implied_from_spread_with_status_flag() -> None:
    store = InMemoryStore()

    await collect_once(TlynAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("tlyn")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.API
    assert terms.buy_fee_percent == Decimal("0.3995")
    assert terms.sell_fee_percent == Decimal("0.3995")
    # سند تحقیق ۰۱ (بند ۳.۸) رفت‌وبرگشت طلاین را ~۰٫۸۰٪ اندازه گرفته بود.
    assert terms.round_trip_percent == Decimal("0.7957")
    # status نماد GOLD18 در فیکسچر "enabled" است ⟸ هر دو سمت باز.
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True


async def test_disabled_status_maps_to_both_sides_closed() -> None:
    payload = load_fixture()
    gold18(payload)["status"] = "disabled"
    store = InMemoryStore()

    await collect_once(TlynAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    stored = await store.get_snapshot("tlyn")
    assert stored is not None
    assert stored.terms.buy_enabled is False
    assert stored.terms.sell_enabled is False


async def test_missing_gold18_symbol_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["prices"] = [p for p in payload["prices"] if p["symbol"] != "GOLD18"]
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(TlynAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("tlyn") is None
    assert await store.get_updated_at("tlyn") is None


async def test_null_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    gold18(payload)["price"]["sell"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(TlynAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("tlyn") is None
