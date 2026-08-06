"""مرز گردآورنده: payload ضبط‌شده‌ی داریک ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/daric_topprice.json` پاسخ واقعی
`GET https://apie.daric.gold/public/general/topprice/GOLD18TMN` است
(ضبط‌شده ۲۰۲۶-۰۸-۰۶ با User-Agent صادق). تست‌ها هیچ تماس شبکه‌ای ندارند.

داریک دفتر سفارش است (بند ۹.۲ نکته‌ی ۵): `bestSell` بهترین سفارش فروش است
⟸ آنچه کاربرِ خریدار می‌پردازد (BUY)؛ `bestSell` تهی ⟸ «آن سمت سفارش
ندارد» — تحمل می‌شود، خطا نیست.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.adapters.daric import DARIC_REST_ENDPOINT, DaricAdapter
from mazane_collector.models import FeeSource, Instrument, MarketModel, Side
from mazane_collector.pipeline import AdapterError, collect_once, collect_round
from mazane_collector.platforms import PLATFORMS
from mazane_collector.sanity import median_outliers
from mazane_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "daric_topprice.json"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_fixture() -> Any:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_fetcher(payload: Any) -> Any:
    async def fetch_json(url: str) -> Any:
        assert url == DARIC_REST_ENDPOINT
        return payload

    return fetch_json


async def test_fixture_payload_is_stored_with_x1_scale_and_book_side_mapping() -> None:
    store = InMemoryStore()

    await collect_once(DaricAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("daric")
    assert stored is not None

    by_side = {quote.side: quote for quote in stored.quotes}
    assert set(by_side) == {Side.MID, Side.BUY, Side.SELL}
    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        # ضریب صریح این منبع: تومان بر گرم، ×۱ (سند تحقیق ۰۱، بند ۳.۳).
        assert quote.raw_scale == Decimal("1")

    # نگاشت دفتر سفارش: BUY (آنچه کاربر می‌پردازد) از bestSell می‌آید —
    # بهترین سفارشِ فروشِ دفتر — و SELL از bestBuy. در فیکسچر واقعی
    # bestSell = 18,579,884 > bestBuy = 18,423,383.
    fixture = load_fixture()
    assert by_side[Side.BUY].price_toman == 18579884
    assert by_side[Side.BUY].raw_value == Decimal(str(fixture["bestSell"]["price"]))
    assert by_side[Side.SELL].price_toman == 18423383
    assert by_side[Side.SELL].raw_value == Decimal(str(fixture["bestBuy"]["price"]))
    assert by_side[Side.MID].price_toman == 18501634


async def test_two_sided_book_terms_are_implied_from_top_of_book() -> None:
    """با هر دو سمت، رفت‌وبرگشت = 1 − bid/ask — هزینه‌ی واقعی معامله‌ی فوری
    سرِ دفتر؛ تمایز جنس این اسپرد با dealer ها را برچسب ORDER_BOOK سکو
    شفاف می‌کند، نه حذف داده."""
    store = InMemoryStore()

    await collect_once(DaricAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("daric")
    assert stored is not None
    terms = stored.terms
    assert terms.fee_source == FeeSource.API
    assert terms.buy_fee_percent == Decimal("0.4229")
    assert terms.sell_fee_percent == Decimal("0.4229")
    assert terms.round_trip_percent == Decimal("0.8423")
    assert terms.buy_enabled is True
    assert terms.sell_enabled is True


async def test_daric_platform_is_labeled_order_book() -> None:
    """معیار پذیرش بلیت ۵: داریک **یک** ردیف با برچسب «دفتر سفارش» دارد —
    دو خوراک، یک اسلاگ، و فقط همین سکو ORDER_BOOK است."""
    daric = [p for p in PLATFORMS if p.slug == "daric"]
    assert len(daric) == 1
    assert daric[0].market_model is MarketModel.ORDER_BOOK
    assert all(
        p.market_model is MarketModel.OTC for p in PLATFORMS if p.slug != "daric"
    )


async def test_null_best_sell_is_one_sided_snapshot_not_an_error() -> None:
    """`bestSell` تهی ⟸ سمت خرید کاربر بی‌سفارش است (بند ۹.۲): سمتِ موجود
    ذخیره می‌شود، MID و کارمزد جعل نمی‌شود، و updated_at جلو می‌رود."""
    payload = load_fixture()
    payload["bestSell"] = None
    store = InMemoryStore()

    await collect_once(DaricAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    stored = await store.get_snapshot("daric")
    assert stored is not None
    assert await store.get_updated_at("daric") == FETCHED_AT

    # فقط سمت فروش کاربر (bestBuy = بهترین سفارش خرید دفتر).
    assert [q.side for q in stored.quotes] == [Side.SELL]
    assert stored.quotes[0].price_toman == 18423383
    assert stored.quotes[0].raw_scale == Decimal("1")

    # سمت غایب صریح برچسب می‌خورد؛ کارمزدی جعل نمی‌شود.
    assert stored.terms.buy_enabled is False
    assert stored.terms.sell_enabled is True
    assert stored.terms.fee_source == FeeSource.UNKNOWN
    assert stored.terms.buy_fee_percent is None
    assert stored.terms.round_trip_percent is None


async def test_null_best_buy_is_the_symmetric_one_sided_case() -> None:
    payload = load_fixture()
    payload["bestBuy"] = None
    store = InMemoryStore()

    await collect_once(DaricAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    stored = await store.get_snapshot("daric")
    assert stored is not None
    assert [q.side for q in stored.quotes] == [Side.BUY]
    assert stored.quotes[0].price_toman == 18579884
    assert stored.terms.buy_enabled is True
    assert stored.terms.sell_enabled is False


async def test_one_sided_snapshot_has_no_mid_and_stays_out_of_median_vote() -> None:
    """بدون MID، داریکِ یک‌طرفه خودبه‌خود در رأی چک میانه نیست — نه رأی
    می‌دهد و نه سرکوب می‌شود."""
    payload = load_fixture()
    payload["bestSell"] = None
    snapshot = DaricAdapter().parse(payload, FETCHED_AT)

    assert all(q.side is not Side.MID for q in snapshot.quotes)
    # حتی کنار سه منبع دیگر، این اسنپ‌شات وارد رأی‌گیری نمی‌شود.
    assert "daric" not in median_outliers([snapshot])


async def test_empty_book_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["bestBuy"] = None
    payload["bestSell"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(DaricAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("daric") is None
    assert await store.get_updated_at("daric") is None


async def test_broken_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["bestBuy"]["price"] = "نامعتبر"
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(DaricAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("daric") is None


async def test_one_sided_daric_survives_a_full_round_without_suppression() -> None:
    """سطح خط لوله: داریکِ یک‌طرفه در نوبت کامل منتشر می‌شود (کهنگی/سرکوبی
    در کار نیست) و فهرست عمومی هم نوشته می‌شود."""
    payload = load_fixture()
    payload["bestSell"] = None
    store = InMemoryStore()

    saved = await collect_round(
        (DaricAdapter(),),
        make_fetcher(payload),
        store,
        platforms=PLATFORMS,
        now=FETCHED_AT,
    )

    assert [s.platform_slug for s in saved] == ["daric"]
    assert saved[0].suppressed is False
    listed = await store.get_listed_platforms()
    assert "daric" in {p.slug for p in listed}
