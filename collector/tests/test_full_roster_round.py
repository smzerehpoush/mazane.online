"""مرز گردآورنده — نوبت کامل ۱۴منبعی (بلیت‌های ۴ و ۵): همه‌ی سکوها از
فیکسچرها می‌گذرند، با میانه سازگارند و در فهرست عمومی ظاهر می‌شوند؛
سکوهای کارمزد-نامعلوم **بعد از** سکوهای دارای قیمت مؤثر می‌آیند.

بلیت ۵ دو سکو اضافه کرد: داریک (REST + وب‌سوکت دفتر سفارش — در این نوبت
از خوراک REST) و اینوی (فقط وب‌سوکت — payload فریمش با کلید همان آدرس
wss در فچر فیکسچری می‌آید، مثل هر endpoint دیگر).

payload ها فیکسچرهای واقعی ضبط‌شده‌ی ۲۰۲۶-۰۸-۰۶ هستند، جز فریم اینوی که
دست‌نویس است (شکل تأییدنشده — docstring آداپترش). هیچ تماس شبکه‌ای نیست.
"""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from mazane_collector.adapters.baazar import BAAZAR_ENDPOINT, BaazarAdapter
from mazane_collector.adapters.daric import DARIC_REST_ENDPOINT, DaricAdapter
from mazane_collector.adapters.digikala import DIGIKALA_ENDPOINT, DigikalaAdapter
from mazane_collector.adapters.ecogold import ECOGOLD_ENDPOINT, EcogoldAdapter
from mazane_collector.adapters.goldika import GOLDIKA_ENDPOINT, GoldikaAdapter
from mazane_collector.adapters.hamrahgold import HAMRAHGOLD_ENDPOINT, HamrahgoldAdapter
from mazane_collector.adapters.invi import INVI_WS_ENDPOINT, InviAdapter
from mazane_collector.adapters.melligold import MELLIGOLD_ENDPOINT, MelligoldAdapter
from mazane_collector.adapters.milli import MILLI_ENDPOINT, MilliAdapter
from mazane_collector.adapters.talasea import TALASEA_ENDPOINT, TalaseaAdapter
from mazane_collector.adapters.technogold import TECHNOGOLD_ENDPOINT, TechnogoldAdapter
from mazane_collector.adapters.tlyn import TLYN_ENDPOINT, TlynAdapter
from mazane_collector.adapters.wallgold import WALLGOLD_ENDPOINT, WallgoldAdapter
from mazane_collector.adapters.zarafza import ZARAFZA_ENDPOINT, ZarafzaAdapter
from mazane_collector.models import FeeSource, Side
from mazane_collector.pipeline import collect_round
from mazane_collector.platforms import PLATFORMS
from mazane_collector.store.memory import InMemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)

ALL_ADAPTERS = (
    WallgoldAdapter(),
    TalaseaAdapter(),
    MilliAdapter(),
    GoldikaAdapter(),
    TechnogoldAdapter(),
    TlynAdapter(),
    EcogoldAdapter(),
    ZarafzaAdapter(),
    BaazarAdapter(),
    DaricAdapter(),
    MelligoldAdapter(),
    DigikalaAdapter(),
    HamrahgoldAdapter(),
    InviAdapter(),
)

FIXTURE_BY_ENDPOINT = {
    WALLGOLD_ENDPOINT: "wallgold_markets.json",
    TALASEA_ENDPOINT: "talasea_gold_price.json",
    MILLI_ENDPOINT: "milli_price_external.json",
    GOLDIKA_ENDPOINT: "goldika_v2_price.json",
    TECHNOGOLD_ENDPOINT: "technogold_only_price.json",
    TLYN_ENDPOINT: "tlyn_price.json",
    ECOGOLD_ENDPOINT: "ecogold_prices_otc.json",
    ZARAFZA_ENDPOINT: "zarafza_prices.json",
    BAAZAR_ENDPOINT: "baazar_price_daily.json",
    DARIC_REST_ENDPOINT: "daric_topprice.json",
    MELLIGOLD_ENDPOINT: "melligold_buy_sell_price.json",
    DIGIKALA_ENDPOINT: "digikala_prices.json",
    HAMRAHGOLD_ENDPOINT: "hamrahgold_xau_changes.json",
    INVI_WS_ENDPOINT: "invi_ws_price.json",
}

# سکوهایی که قیمت مؤثر دارند، به همان ترتیبی که باید در فهرست عمومی بیایند.
KNOWN_FEE_LISTED = (
    "wallgold",
    "talasea",
    "milli",
    "technogold",
    "tlyn",
    "ecogold",
    "zarafza",
    "baazar",
    "daric",
)
# کارمزد نامعلوم ⟸ قیمت مؤثر ندارند و باید **بعد از** بقیه بیایند.
UNKNOWN_FEE_LISTED = ("melligold", "digikala", "hamrahgold", "invi")


def make_fetcher() -> Any:
    async def fetch_json(url: str) -> Any:
        name = FIXTURE_BY_ENDPOINT[url]
        return json.loads((FIXTURES / name).read_text(encoding="utf-8"))

    return fetch_json


async def test_healthy_round_publishes_all_fourteen_sources() -> None:
    """معیارهای پذیرش بلیت‌های ۴ و ۵: هر ۱۴ سکو — از جمله داریک (دفتر
    سفارش) و اینوی (وب‌سوکت) — با داده‌ی فیکسچر منتشر می‌شوند و هیچ‌کدام
    از چک میانه رد نمی‌شوند — یعنی mid همه با میانه‌ی سایر منابع سازگار است."""
    store = InMemoryStore()

    saved = await collect_round(
        ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT
    )

    assert len(saved) == 14
    assert all(not snapshot.suppressed for snapshot in saved)
    for adapter in ALL_ADAPTERS:
        assert await store.get_snapshot(adapter.slug) is not None
        assert await store.get_updated_at(adapter.slug) == FETCHED_AT


async def test_unknown_fee_platforms_have_mid_only_and_unknown_terms() -> None:
    store = InMemoryStore()

    await collect_round(ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT)

    for slug in UNKNOWN_FEE_LISTED:
        snapshot = await store.get_snapshot(slug)
        assert snapshot is not None
        assert [q.side for q in snapshot.quotes] == [Side.MID]
        assert snapshot.terms.fee_source == FeeSource.UNKNOWN

    for slug in KNOWN_FEE_LISTED:
        snapshot = await store.get_snapshot(slug)
        assert snapshot is not None
        assert {q.side for q in snapshot.quotes} == {Side.MID, Side.BUY, Side.SELL}
        assert snapshot.terms.fee_source != FeeSource.UNKNOWN
        assert snapshot.terms.round_trip_percent is not None


async def test_listed_payload_orders_unknown_fee_platforms_last() -> None:
    """سکوی بدون قیمت مؤثر («قیمت در دسترس نیست») باید بعد از سکوهای
    قیمت‌دار بیاید؛ ترتیب فهرست همان ترتیب PLATFORMS است که استورها حفظ
    می‌کنند."""
    store = InMemoryStore()

    await collect_round(ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT)

    listed = await store.get_listed_platforms()
    assert tuple(p.slug for p in listed) == KNOWN_FEE_LISTED + UNKNOWN_FEE_LISTED
    # گلدیکا PERMISSION_PENDING است و هرگز در فهرست عمومی نمی‌آید (تصمیم ۱۲).
    assert "goldika" not in {p.slug for p in listed}


async def test_listed_payload_shape_carries_market_model() -> None:
    """قرارداد با `web/lib/prices.ts` (ListedPlatform): بلیت ۵ فیلد
    `market_model` را اضافه کرد (برچسب «دفتر سفارش» — بند ۹.۲ نکته‌ی ۵)،
    بلیت ۷ فراداده‌ی صفحه‌ی سکو را: `name_en`، `website_url`،
    `legal_entity`، `delivery_note_fa` (اختیاری — جای نامستند None) و
    بلیت ۹ فیلدهای معرف را: `referral_url`، `referral_param` (تصمیم ۲۱).
    داریک تنها ORDER_BOOK است؛ بقیه OTC."""
    store = InMemoryStore()
    await store.save_platforms(PLATFORMS)

    listed = await store.get_listed_platforms()
    for platform in listed:
        payload = platform.model_dump(mode="json")
        assert set(payload) == {
            "slug",
            "name_fa",
            "data_policy",
            "market_model",
            "name_en",
            "website_url",
            "legal_entity",
            "delivery_note_fa",
            "referral_url",
            "referral_param",
        }
        assert payload["data_policy"] == "ALLOWED"
        expected = "ORDER_BOOK" if payload["slug"] == "daric" else "OTC"
        assert payload["market_model"] == expected
        # نشانی وب‌سایت هر ۱۴ سکو در سند تحقیق ۰۱ مستند است.
        assert isinstance(payload["website_url"], str)
        assert payload["website_url"].startswith("https://")
    assert "daric" in {p.slug for p in listed}
    # فراداده‌ی مستندشده در سند تحقیق ۰۱ سر جای خودش است؛ نامستند None است.
    by_slug = {p.slug: p for p in listed}
    assert by_slug["talasea"].legal_entity == "شرکت توسعه راهکار الوند ارسباران"
    assert by_slug["milli"].delivery_note_fa == "کارمزد تحویل فیزیکی ۳٪"
    assert by_slug["wallgold"].legal_entity is None
    assert by_slug["wallgold"].delivery_note_fa is None
