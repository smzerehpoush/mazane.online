"""مرز گردآورنده: payload ضبط‌شده‌ی زرافزا ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/zarafza_prices.json` پاسخ واقعی
`GET https://api.zarafza.com/wallets/v1/prices` است (ضبط‌شده ۲۰۲۶-۰۸-۰۶ با
User-Agent صادق). تست‌ها هیچ تماس شبکه‌ای ندارند.

⚠️ دو نکته‌ی تأییدشده‌ی سند تحقیق ۰۱:
- نام‌گذاری «دید فروشنده» است (بند ۳.۲): `sell` بزرگ‌تر = آنچه کاربر می‌پردازد.
- زرافزا دو سطح قیمت دارد (بند ۳.۶): `price` و `instant` (اسپرد پهن‌تر)؛
  مبنای مقایسه سطح `price` است.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.zarafza import ZARAFZA_ENDPOINT, ZarafzaAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "zarafza_prices.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == ZARAFZA_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_inverted_sides_from_price_level() -> None:
    store = InMemoryStore()

    await collect_once(ZarafzaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("zarafza")
    assert stored is not None
    assert stored.platform_slug == "zarafza"

    (price,) = stored.quotes
    # یک سکو، یک سطر — «قیمت»، پیش از کارمزد (سند تصمیم ۰۰۰۲).
    assert price.side is Side.PRICE

    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        # ضریب صریح این منبع: تومان بر گرم، ×۱ (سند تحقیق ۰۱، بند ۳.۳).
        assert quote.raw_scale == Decimal("1")

    # وارونگی سمت‌ها: `G18.sell.price = 18599036.0` بزرگ‌تر است ⟸ BUY مؤثر
    # (آنچه کاربر می‌پردازد) از فیلد **sell** منبع می‌آید — و از سطح `price`
    # نه `instant` (که 18701330 است).
    assert price.price_toman == 18530376


async def test_terms_are_implied_from_dealer_spread_as_implied() -> None:
    store = InMemoryStore()

    await collect_once(ZarafzaAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("zarafza")
    assert stored is not None
    terms = stored.terms

    assert terms.fee_source == FeeSource.IMPLIED
    assert terms.buy_fee_percent == Decimal("0.3705")
    assert terms.sell_fee_percent == Decimal("0.3705")
    # هم‌مرتبه با اندازه‌گیری سند تحقیق ۰۱ (بند ۳.۸): ~۰٫۴۷٪ در آن اسنپ‌شات.
    assert terms.round_trip_percent == Decimal("0.7383")
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True


async def test_missing_g18_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    del payload["data"]["G18"]
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(ZarafzaAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("zarafza") is None
    assert await store.get_updated_at("zarafza") is None


async def test_null_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["data"]["G18"]["sell"]["price"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(ZarafzaAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("zarafza") is None
