"""مرز گردآورنده: payload ضبط‌شده‌ی داریک ⟸ ردیف‌های ذخیره‌شده در استور.

فیکسچر `fixtures/daric_collateral_price.json` پاسخ واقعی
`GET https://apisc.daric.gold/loan/api/v1/User/Collateral/GetGoldlPrice` است
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

from tablo_collector.adapters.daric import DARIC_REST_ENDPOINT, DaricAdapter
from tablo_collector.models import FeeSource, Instrument, MarketModel, Side
from tablo_collector.pipeline import AdapterError, collect_once, collect_round
from tablo_collector.platforms import PLATFORMS
from tablo_collector.sanity import median_outliers
from tablo_collector.store.memory import InMemoryStore

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "daric_collateral_price.json"
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

    (price,) = stored.quotes
    # یک سکو، یک سطر — «قیمت»، پیش از کارمزد (سند تصمیم ۰۰۰۲).
    assert price.side is Side.PRICE
    for quote in stored.quotes:
        assert quote.instrument == Instrument.GOLD_18K
        # ضریب صریح این منبع: تومان بر گرم، ×۱ (سند تحقیق ۰۱، بند ۳.۳).
        assert quote.raw_scale == Decimal("1")

    # قیمت = میانگین دو سرِ دفتر (سند تصمیم ۰۰۰۲). فیکسچر واقعی:
    # bestSell = 18,579,884 و bestBuy = 18,423,383 ⟸ میانگین ۱۸٬۵۰۱٬۶۳۳٫۵.
    assert price.price_toman == 18501634


async def test_order_book_spread_is_not_recorded_as_a_fee() -> None:
    """کارمزد داریک ۰٪ است (تصمیم مالک ۲۰۲۶-۰۸-۱۰؛ سند تصمیم ۰۰۰۲).

    اسپردِ دفتر عمداً کارمزد شمرده نمی‌شود: سفارشِ کاربران دیگر است و درآمد
    هیچ‌کس نیست، پس `IMPLIED` هم برایش غلط بود. پیامد پذیرفته‌شده: رفت‌وبرگشت
    داریک ۰٪ گزارش می‌شود، در حالی که خرید و فروش فوری سرِ دفتر واقعاً
    `1 − bid/ask` هزینه دارد.
    """
    store = InMemoryStore()

    await collect_once(DaricAdapter(), make_fetcher(load_fixture()), store, now=FETCHED_AT)

    stored = await store.get_snapshot("daric")
    assert stored is not None
    terms = stored.terms
    assert terms.fee_source == FeeSource.MANUAL
    assert terms.buy_fee_percent == Decimal("0.0000")
    assert terms.sell_fee_percent == Decimal("0.0000")
    assert terms.round_trip_percent == Decimal("0.0000")
    # صفر با تهی یکی نیست: اینجا می‌دانیم کارمزدی نیست.
    assert terms.buy_fee_percent is not None
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


@pytest.mark.parametrize("missing", ["BestSellPrice", "BestBuyPrice"])
async def test_one_sided_book_has_no_price_and_stores_nothing(missing: str) -> None:
    """یک سمتِ خالی ⟸ میانگینی نیست ⟸ آن نوبت قیمت ندارد (سند تصمیم ۰۰۰۲).

    پیش‌تر همان یک سمت ذخیره می‌شد. آن عدد سوگیرانه بود — فقط `bestSell`
    مانده ⟸ بالاتر از میانگین، فقط `bestBuy` مانده ⟸ پایین‌تر — و چون جدول
    بر اساس قیمت مرتب می‌شود، رتبه‌ی داریک به این وابسته می‌شد که کدام سمت
    دفترش خالی شده. حالا آخرین عدد سالم کهنه می‌ماند (قاعده‌ی سخت ۵).
    """
    payload = load_fixture()
    payload["Data"][missing] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(DaricAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("daric") is None
    assert await store.get_updated_at("daric") is None


async def test_empty_book_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["Data"]["BestBuyPrice"] = None
    payload["Data"]["BestSellPrice"] = None
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(DaricAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("daric") is None
    assert await store.get_updated_at("daric") is None


async def test_broken_price_raises_and_stores_nothing() -> None:
    payload = load_fixture()
    payload["Data"]["BestBuyPrice"] = "نامعتبر"
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        await collect_once(DaricAdapter(), make_fetcher(payload), store, now=FETCHED_AT)

    assert await store.get_snapshot("daric") is None


async def test_one_sided_daric_is_stale_in_a_full_round_not_an_error() -> None:
    """سطح خط لوله: دفتر یک‌سمته کل نوبت را نمی‌شکند — داریک آن نوبت چیزی
    منتشر نمی‌کند و فهرست عمومی همچنان نوشته می‌شود (قاعده‌ی سخت ۵)."""
    payload = load_fixture()
    payload["Data"]["BestSellPrice"] = None
    store = InMemoryStore()

    saved = await collect_round(
        (DaricAdapter(),),
        make_fetcher(payload),
        store,
        platforms=PLATFORMS,
        now=FETCHED_AT,
    )

    assert saved == ()
    assert await store.get_snapshot("daric") is None
    listed = await store.get_listed_platforms()
    assert "daric" in {p.slug for p in listed}


def test_rest_and_websocket_payload_shapes_agree() -> None:
    """خوراک REST شکل تخت `Data.BestBuyPrice` (رشته) دارد و وب‌سوکت شکل
    تودرتوی `bestBuy.price` (عدد) — هر دو باید به یک عدد برسند.

    این تست دلیل وجود `_top_of_book` است: بدون آن، دو نسخه‌ی موازی از همین
    منطق پیدا می‌شد و یکی‌شان بی‌سروصدا کهنه می‌ماند.
    """
    rest = {"Data": {"BestBuyPrice": "18423383", "BestSellPrice": "18579884"}}
    websocket = {"bestBuy": {"price": 18423383.0}, "bestSell": {"price": 18579884.0}}

    from_rest = DaricAdapter().parse(rest, FETCHED_AT)
    from_ws = DaricAdapter().parse(websocket, FETCHED_AT)

    assert from_rest.quotes[0].price_toman == from_ws.quotes[0].price_toman == 18501634
