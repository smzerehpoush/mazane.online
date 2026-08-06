"""مرز گردآورنده — نوبت کامل ۱۲منبعی بلیت ۴: هر هشت سکوی جدید کنار چهار
سکوی قبلی از فیکسچرهای واقعی می‌گذرند، با میانه سازگارند و در فهرست عمومی
ظاهر می‌شوند؛ سکوهای کارمزد-نامعلوم **بعد از** سکوهای دارای قیمت مؤثر می‌آیند.

همه‌ی payload ها فیکسچرهای واقعی ضبط‌شده‌ی ۲۰۲۶-۰۸-۰۶ هستند. هیچ تماس
شبکه‌ای نیست.
"""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from mazane_collector.adapters.baazar import BAAZAR_ENDPOINT, BaazarAdapter
from mazane_collector.adapters.digikala import DIGIKALA_ENDPOINT, DigikalaAdapter
from mazane_collector.adapters.ecogold import ECOGOLD_ENDPOINT, EcogoldAdapter
from mazane_collector.adapters.goldika import GOLDIKA_ENDPOINT, GoldikaAdapter
from mazane_collector.adapters.hamrahgold import HAMRAHGOLD_ENDPOINT, HamrahgoldAdapter
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
    MelligoldAdapter(),
    DigikalaAdapter(),
    HamrahgoldAdapter(),
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
    MELLIGOLD_ENDPOINT: "melligold_buy_sell_price.json",
    DIGIKALA_ENDPOINT: "digikala_prices.json",
    HAMRAHGOLD_ENDPOINT: "hamrahgold_xau_changes.json",
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
)
# کارمزد نامعلوم ⟸ قیمت مؤثر ندارند و باید **بعد از** بقیه بیایند.
UNKNOWN_FEE_LISTED = ("melligold", "digikala", "hamrahgold")


def make_fetcher() -> Any:
    async def fetch_json(url: str) -> Any:
        name = FIXTURE_BY_ENDPOINT[url]
        return json.loads((FIXTURES / name).read_text(encoding="utf-8"))

    return fetch_json


async def test_healthy_round_publishes_all_twelve_sources() -> None:
    """معیار پذیرش بلیت ۴: هر هشت سکوی جدید با داده‌ی (فیکسچر) زنده کنار
    چهار سکوی قبلی منتشر می‌شوند و هیچ‌کدام از چک میانه رد نمی‌شوند —
    یعنی mid همه با میانه‌ی سایر منابع سازگار است."""
    store = InMemoryStore()

    saved = await collect_round(
        ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT
    )

    assert len(saved) == 12
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


async def test_listed_payload_shape_stays_backward_compatible() -> None:
    """قرارداد با `web/lib/prices.ts` (ListedPlatform): دقیقاً همان سه فیلد
    قبلی — سکوی جدید فیلد تازه‌ای به فهرست اضافه نمی‌کند."""
    store = InMemoryStore()
    await store.save_platforms(PLATFORMS)

    for platform in await store.get_listed_platforms():
        payload = platform.model_dump(mode="json")
        assert set(payload) == {"slug", "name_fa", "data_policy"}
        assert payload["data_policy"] == "ALLOWED"
