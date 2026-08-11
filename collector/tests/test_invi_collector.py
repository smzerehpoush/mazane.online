"""مرز گردآورنده: فریم وب‌سوکت اینوی ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/invi_ws_price.json` **دست‌نویس** است: اینوی فقط
`wss://invi.ir/ws` دارد و شکل پیامش «تأییدنشده» است (سند تحقیق ۰۱، بند
۲.۲ + «نتوانستم تأیید کنم» ردیف ۱؛ تلاش اتصال ۲۰۲۶-۰۸-۰۶ از این شبکه ۴۰۳
گرفت). شکل فرضی همین فیکسچر است و پارسر عمداً به آن سخت‌گیر است — هر چیز
دیگری کهنگی می‌سازد، نه داده‌ی غلط.

معیار پذیرش بلیت ۵: اینوی در جدول است (فهرست عمومی)؛ کارمزدش نامعلوم است
⟸ فقط MID؛ و قطع وب‌سوکت در سطح خط لوله بیات‌شدگی است، نه خطا.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.adapters.invi import (
    INVI_WS_ENDPOINT,
    InviAdapter,
    decode_invi_message,
)
from tablo_collector.adapters.wallgold import WALLGOLD_ENDPOINT, WallgoldAdapter
from tablo_collector.models import FeeSource, Instrument, Side
from tablo_collector.pipeline import AdapterError, collect_once, collect_round
from tablo_collector.platforms import PLATFORMS
from tablo_collector.store.memory import InMemoryStore
from tablo_collector.ws import FeedStale

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads((FIXTURES / "invi_ws_price.json").read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == INVI_WS_ENDPOINT
        if isinstance(payload, Exception):
            raise payload
        return payload

    return fetch_json


async def test_fixture_frame_is_stored_mid_only_with_unknown_fee() -> None:
    store = InMemoryStore()

    await collect_once(InviAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("invi")
    assert stored is not None
    assert await store.get_updated_at("invi") == FETCHED_AT

    # کارمزد نامعلوم ⟸ فقط MID و سطر MEAN که بازتاب همان تک‌عدد است
    # (سکوی تک‌قیمتی: عددی که منتشر می‌کند قیمت مرجع اوست). قیمت مؤثر
    # همچنان جعل نمی‌شود — نه BUY هست نه SELL.
    assert [q.side for q in stored.quotes] == [Side.PRICE]
    quote = stored.quotes[0]
    assert quote.instrument == Instrument.GOLD_18K
    # ضریب فرضی این منبع: تومان بر گرم، ×۱ — ریاضی مقیاس قفل می‌شود.
    assert quote.raw_value == Decimal("18529000")
    assert quote.raw_scale == Decimal("1")
    assert quote.price_toman == 18529000

    assert stored.terms.fee_source == FeeSource.UNKNOWN
    assert stored.terms.buy_fee_percent is None
    assert stored.terms.sell_fee_percent is None
    assert stored.terms.round_trip_percent is None


def test_decoder_ignores_unrelated_frames_instead_of_erroring() -> None:
    assert decode_invi_message("نه-JSON") is None
    assert decode_invi_message(json.dumps({"type": "ping"})) is None
    assert decode_invi_message(json.dumps({"symbol": "SILVER", "price": 1})) is None
    assert decode_invi_message(json.dumps(load_fixture())) == load_fixture()


async def test_null_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["price"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(InviAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("invi") is None
    assert await store.get_updated_at("invi") is None


async def test_unexpected_frame_shape_raises_and_stores_nothing() -> None:
    """شکل فریم فرضی است — هر شکل دیگری باید خطای آداپتر بدهد (⟸ در نوبت
    کامل فقط کهنگی)، نه اینکه عددی حدسی ذخیره شود."""
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(
            InviAdapter(), make_fetcher({"data": {"gold": 123}}), store, now=FETCHED_AT
        )

    assert await store.get_snapshot("invi") is None


async def test_ws_disconnect_is_staleness_at_the_pipeline_level_not_a_crash() -> None:
    """معیار پذیرش: قطع وب‌سوکت ⟸ بیات‌شدگی همان سکو؛ نوبت و سایر سکوها
    سالم ادامه می‌دهند."""
    wallgold_payload = json.loads(
        (FIXTURES / "wallgold_markets.json").read_text(encoding="utf-8")
    )
    payloads: dict[str, Any] = {
        WALLGOLD_ENDPOINT: wallgold_payload,
        INVI_WS_ENDPOINT: FeedStale("خوراک اینوی فریم تازه ندارد"),
    }

    async def fetch_json(url: str) -> Any:
        value = payloads[url]
        if isinstance(value, Exception):
            raise value
        return value

    store = InMemoryStore()
    saved = await collect_round(
        (WallgoldAdapter(), InviAdapter()),
        fetch_json,
        store,
        platforms=PLATFORMS,
        now=FETCHED_AT,
    )

    # اینوی کهنه ماند (نه اسنپ‌شات، نه updated_at)، وال‌گلد منتشر شد.
    assert {s.platform_slug for s in saved} == {"wallgold"}
    assert await store.get_snapshot("invi") is None
    assert await store.get_updated_at("invi") is None
    assert await store.get_snapshot("wallgold") is not None
    # فهرست عمومی هم نوشته شد — صفحه ۲۰۰ می‌ماند و اینوی «آخرین به‌روزرسانی» می‌گیرد.
    assert "invi" in {p.slug for p in await store.get_listed_platforms()}
