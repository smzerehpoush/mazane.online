"""مرز گردآورنده — سطر `MEAN`: «قیمت مرجع سکو» به‌عنوان ردیف ماندگار.

قاعده‌ی قطعی (تصمیم صاحب کسب‌وکار ۲۰۲۶-۰۸-۰۶، CONTEXT.md «قیمت مرجع سکو»):
سکویی که **دو** عدد منتشر می‌کند ⟸ میانگین آن دو؛ سکویی که **یک** عدد منتشر
می‌کند ⟸ همان عدد؛ دفتر سفارشِ یک‌طرفه ⟸ اصلاً قیمت مرجع ندارد و جعل نمی‌شود.

چرا ردیف و نه مقدار محاسبه‌شده‌ی لحظه‌ای: نمودار ۲۴ ساعته‌ی صفحه‌ی اصلی سری
تاریخی همین عدد را می‌خواهد؛ تا امروز فقط یک computed_field در JSON بود و در
پستگرس ذخیره نمی‌شد ⟸ نه تاریخچه داشت نه تجمیع ساعتی.

⚠️ `MEAN` هرگز میانگین بین‌سکویی نیست (قاعده‌ی ۴ قراردادها): هر سطر فقط از
سطرهای همان یک سکو ساخته می‌شود و `platform_slug` خودش را حمل می‌کند.

هیچ تماس شبکه‌ای در کار نیست — فیکسچر و سازنده‌های `adapters.common`.
"""

import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from mazane_collector.adapters.common import (
    dealer_snapshot,
    one_sided_book_snapshot,
    unknown_fee_snapshot,
)
from mazane_collector.adapters.wallgold import WALLGOLD_ENDPOINT, WallgoldAdapter
from mazane_collector.models import (
    FeeSource,
    Instrument,
    PlatformSnapshot,
    PlatformTerms,
    Quote,
    Side,
)
from mazane_collector.pipeline import collect_once
from mazane_collector.retention import SourceKind, rollup_completed_hours
from mazane_collector.sanity import median_outliers
from mazane_collector.store.memory import InMemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def mean_of(snapshot: PlatformSnapshot) -> Quote:
    """تنها سطر MEAN اسنپ‌شات — بیش از یکی یعنی باگ idempotency."""
    means = [quote for quote in snapshot.quotes if quote.side is Side.MEAN]
    assert len(means) == 1, f"دقیقاً یک سطر MEAN انتظار می‌رود، {len(means)} تا آمد"
    return means[0]


# ――― قاعده‌ی مقدار ―――


def test_dual_price_platform_mean_is_the_average_of_its_own_two_numbers() -> None:
    """سکوی دوقیمتی: میانگین همان دو عددِ خودش، و نه چیز دیگر."""
    snapshot = dealer_snapshot(
        slug="ecogold",
        raw_first=Decimal("18436000"),
        raw_second=Decimal("18398000"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )

    mean = mean_of(snapshot)
    assert mean.price_toman == 18417000  # (18436000 + 18398000) ÷ 2
    assert mean.raw_value == Decimal("18417000")
    assert mean.raw_scale == Decimal("1")
    assert mean.platform_slug == "ecogold"
    assert mean.instrument is Instrument.GOLD_18K
    assert mean.fetched_at == FETCHED_AT
    assert snapshot.reference_prices_toman == {"GOLD_18K": 18417000}


async def test_single_price_known_fee_platform_mean_is_its_published_number() -> None:
    """سکوی تک‌قیمتی با کارمزد معلوم (وال‌گلد): قیمت مؤثر دو سمت از یک عدد
    ساخته می‌شود، پس میانگینشان دقیقاً به همان عددِ منتشرشده برمی‌گردد —
    همان چیزی که قاعده‌ی «یک عدد ⟸ همان عدد» می‌خواهد."""
    store = InMemoryStore()
    payload = json.loads((FIXTURES / "wallgold_markets.json").read_text(encoding="utf-8"))

    async def fetch_json(url: str) -> Any:
        assert url == WALLGOLD_ENDPOINT
        return payload

    await collect_once(WallgoldAdapter(), fetch_json, store, now=FETCHED_AT)

    snapshot = await store.get_snapshot("wallgold")
    assert snapshot is not None
    mid = next(quote for quote in snapshot.quotes if quote.side is Side.MID)
    assert mean_of(snapshot).price_toman == mid.price_toman == 18611000


def test_single_price_unknown_fee_platform_mean_comes_from_mid() -> None:
    """کارمزد نامعلوم (فقط MID): قیمت مؤثر همچنان جعل نمی‌شود — نه BUY هست نه
    SELL — ولی سکو بی‌قیمت‌مرجع نمی‌ماند: همان تک‌عددش نماینده‌اش می‌شود."""
    snapshot = unknown_fee_snapshot(
        slug="melligold",
        raw_mid=Decimal("18506373"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )

    assert [quote.side for quote in snapshot.quotes] == [Side.MID, Side.MEAN]
    assert snapshot.terms.fee_source is FeeSource.UNKNOWN
    mean = mean_of(snapshot)
    assert mean.price_toman == 18506373
    assert mean.raw_value == Decimal("18506373")
    assert snapshot.reference_prices_toman == {"GOLD_18K": 18506373}


def test_one_sided_order_book_gets_no_mean_row() -> None:
    """دفتر سفارش با یک سمتِ تهی نه دو عدد دارد که میانگین بگیریم نه عددی
    دوطرفه ⟸ سطر MEAN ساخته نمی‌شود؛ خط این سکو در آن بازه غایب است، نه جعلی."""
    snapshot = one_sided_book_snapshot(
        slug="daric",
        side=Side.SELL,
        raw_value=Decimal("18423383"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )

    assert [quote.side for quote in snapshot.quotes] == [Side.SELL]
    assert snapshot.reference_prices_toman == {}


# ――― idempotency: بازسازی اسنپ‌شات سطر تکراری نمی‌سازد ―――


def test_mean_row_survives_redis_json_round_trip_without_duplicating() -> None:
    """اسنپ‌شات از JSON کانونی ردیس دوباره ساخته می‌شود؛ سطر MEAN همان‌جاست و
    اعتبارسنج دوباره اضافه‌اش نمی‌کند (وگرنه هر بار خواندن یک سطر تکراری)."""
    snapshot = dealer_snapshot(
        slug="technogold",
        raw_first=Decimal("18615615"),
        raw_second=Decimal("18384078"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )

    once = PlatformSnapshot.model_validate_json(snapshot.model_dump_json())
    twice = PlatformSnapshot.model_validate_json(once.model_dump_json())

    assert once.quotes == snapshot.quotes
    assert twice.quotes == snapshot.quotes
    assert [quote.side for quote in twice.quotes] == [
        Side.MID,
        Side.BUY,
        Side.SELL,
        Side.MEAN,
    ]
    assert twice.reference_prices_toman == snapshot.reference_prices_toman


def test_mean_row_is_not_rebuilt_when_snapshot_is_reassembled_from_stored_rows() -> None:
    """بازسازی از ردیف‌های پستگرس (همان کاری که `PostgresStore.get_snapshot`
    می‌کند): سطرهای ذخیره‌شده — از جمله MEAN — عیناً برمی‌گردند."""
    original = dealer_snapshot(
        slug="baazar",
        raw_first=Decimal("18622736"),
        raw_second=Decimal("18414969"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )

    rebuilt = PlatformSnapshot(
        platform_slug=original.platform_slug,
        quotes=original.quotes,
        terms=original.terms,
        fetched_at=original.fetched_at,
    )

    assert rebuilt.quotes == original.quotes
    # پرچم‌زدن سرکوب در خط لوله هم از مسیر model_copy می‌رود ⟸ بدون اعتبارسنجی.
    assert rebuilt.model_copy(update={"suppressed": True}).quotes == original.quotes


# ――― مرزهای حقوقی و ایمنی ―――


def test_mean_is_attributed_to_one_named_platform_only() -> None:
    """خط قرمز بند ۷.۱: هیچ سطری از دو سکو ساخته نمی‌شود. دو سکوی هم‌زمان،
    دو سطر MEAN جدا با اسلاگ خودشان — و عددشان به سکوی دیگر بی‌اعتناست."""
    first = dealer_snapshot(
        slug="tlyn",
        raw_first=Decimal("18599000"),
        raw_second=Decimal("18451000"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )
    second = dealer_snapshot(
        slug="zarafza",
        raw_first=Decimal("18599036"),
        raw_second=Decimal("18461716"),
        scale=Decimal("1"),
        fetched_at=FETCHED_AT,
    )

    assert mean_of(first).platform_slug == "tlyn"
    assert mean_of(second).platform_slug == "zarafza"
    assert mean_of(first).price_toman == 18525000  # فقط از دو عدد طلاین
    assert mean_of(second).price_toman == 18530376  # فقط از دو عدد زرافزا


def test_mismatched_raw_scale_between_sides_is_rejected_with_a_clear_error() -> None:
    """میانگینِ خامِ دو مقیاسِ متفاوت عددی بی‌معناست ⟸ خطای صریح، نه سطر خراب."""

    def quote(side: Side, price: int, scale: str) -> Quote:
        return Quote(
            platform_slug="brokenscale",
            instrument=Instrument.GOLD_18K,
            side=side,
            price_toman=price,
            raw_value=Decimal(price),
            raw_scale=Decimal(scale),
            fetched_at=FETCHED_AT,
        )

    terms = PlatformTerms(
        platform_slug="brokenscale",
        buy_fee_percent=Decimal("1"),
        sell_fee_percent=Decimal("1"),
        round_trip_percent=Decimal("2"),
        fee_source=FeeSource.MANUAL,
        buy_enabled=True,
        sell_enabled=True,
        observed_at=FETCHED_AT,
    )

    with pytest.raises(ValidationError, match="ضریب دو سمت یکی نیست"):
        PlatformSnapshot(
            platform_slug="brokenscale",
            quotes=(quote(Side.BUY, 18_600_000, "1"), quote(Side.SELL, 18_400_000, "0.1")),
            terms=terms,
            fetched_at=FETCHED_AT,
        )


def test_median_check_votes_on_mid_only_and_ignores_mean() -> None:
    """چک میانه فقط با MID رأی می‌گیرد: سطر MEAN مشتقِ همان منبع است و
    آوردنش یعنی شمردن یک منبع دو بار. اینجا MEANِ یک سکو عمداً پرت است ولی
    MID همه سازگارند ⟸ هیچ‌کس سرکوب نمی‌شود."""

    def snapshot(slug: str, mid: int, mean: int) -> PlatformSnapshot:
        def quote(side: Side, price: int) -> Quote:
            return Quote(
                platform_slug=slug,
                instrument=Instrument.GOLD_18K,
                side=side,
                price_toman=price,
                raw_value=Decimal(price),
                raw_scale=Decimal(1),
                fetched_at=FETCHED_AT,
            )

        return PlatformSnapshot(
            platform_slug=slug,
            # MEAN صریح ⟸ اعتبارسنج دست نمی‌زند (همان idempotency).
            quotes=(quote(Side.MID, mid), quote(Side.MEAN, mean)),
            terms=PlatformTerms(
                platform_slug=slug,
                buy_fee_percent=None,
                sell_fee_percent=None,
                round_trip_percent=None,
                fee_source=FeeSource.UNKNOWN,
                buy_enabled=True,
                sell_enabled=True,
                observed_at=FETCHED_AT,
            ),
            fetched_at=FETCHED_AT,
        )

    snapshots = [
        snapshot("wallgold", 18_500_000, 18_500_000),
        snapshot("milli", 18_505_000, 18_505_000),
        snapshot("talasea", 18_495_000, 99_000_000),  # MEANِ پرت، MID سالم
    ]

    assert median_outliers(snapshots) == frozenset()


# ――― چیزی که کل این کارت برایش است: سری تاریخی نمودار ―――


async def test_mean_series_reaches_hourly_rollups() -> None:
    """سطر MEAN مثل هر سطر دیگر تجمیع ساعتی می‌گیرد ⟸ نمودار ۲۴ ساعته
    می‌تواند خط هر سکو را از تاریخچه بخواند، نه از قیمت جاری."""
    store = InMemoryStore()
    base = datetime(2026, 8, 6, 9, 0, 0, tzinfo=UTC)
    for minute, (ask, bid) in enumerate(
        ((Decimal("18600000"), Decimal("18400000")), (Decimal("18700000"), Decimal("18500000"))),
    ):
        await store.save_snapshot(
            dealer_snapshot(
                slug="tlyn",
                raw_first=ask,
                raw_second=bid,
                scale=Decimal("1"),
                fetched_at=base + timedelta(minutes=minute * 10),
            )
        )

    await rollup_completed_hours(store, now=base + timedelta(hours=1, minutes=5))

    rollups = await store.get_hourly_rollups(SourceKind.PLATFORM, "tlyn", "GOLD_18K")
    by_side = {rollup.side: rollup for rollup in rollups}
    assert "MEAN" in by_side
    mean_rollup = by_side["MEAN"]
    assert mean_rollup.open_value == Decimal("18500000")  # (18.6م + 18.4م) ÷ 2
    assert mean_rollup.close_value == Decimal("18600000")  # (18.7م + 18.5م) ÷ 2
    assert mean_rollup.sample_count == 2
