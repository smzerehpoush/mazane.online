"""مرز گردآورنده — نگه‌داری داده (بلیت ۱۶): تجمیع ساعتی، فشرده‌سازی، هرس.

ردیف‌های خام مصنوعی در چند ساعت وارد استور (فیک درون‌حافظه‌ای) می‌شوند و
رفتار بیرونی سه کار نگه‌داری بررسی می‌شود:

- تجمیع ساعتی: کمینه/بیشینه/باز/بسته + شمار نمونه، فقط ساعت‌های کامل‌شده،
  بازاجرا بدون تکرار (upsert).
- هرس: فقط ردیف‌های قدیمی‌تر از ۹۰ روز که ساعتشان تجمیع موفق دارد
  (معیار پذیرش: «هرس فقط بعد از تجمیع موفق همان بازه»).
- فشرده‌سازی تکراری‌های متوالی: از هر دنباله‌ی مقدار یکسان، اولین و آخرین
  ردیف می‌مانند (قرارداد دفاع‌پذیری مستند در `retention.py`).

هیچ تماس شبکه‌ای و هیچ سرویس زنده‌ای در کار نیست.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from mazane_collector.models import (
    FeeSource,
    Instrument,
    PlatformSnapshot,
    PlatformTerms,
    Quote,
    Side,
)
from mazane_collector.references import (
    ReferenceInstrument,
    ReferenceQuote,
    ReferenceSnapshot,
)
from mazane_collector.retention import (
    SourceKind,
    compress_duplicate_runs,
    hour_floor,
    prune_expired_raw,
    retention_pass,
    rollup_completed_hours,
)
from mazane_collector.store.memory import InMemoryStore

# ساعت ۱۰:۰۰ یک روز دلخواه — همه‌ی زمان‌ها تزریقی‌اند، ساعت سیستم بی‌اثر است.
BASE = datetime(2026, 1, 15, 10, 0, 0, tzinfo=UTC)
FAR = BASE + timedelta(days=365)

# قیمت مؤثر دو سمت از یک mid مصنوعی ساخته می‌شود تا هر سری قابل تشخیص باشد.
BUY_DELTA = 1_000
SELL_DELTA = -1_000


def make_snapshot(
    mid: int,
    at: datetime,
    *,
    slug: str = "wallgold",
    suppressed: bool = False,
) -> PlatformSnapshot:
    quotes = tuple(
        Quote(
            platform_slug=slug,
            instrument=Instrument.GOLD_18K,
            side=side,
            price_toman=mid + delta,
            raw_value=Decimal(mid),
            raw_scale=Decimal(1),
            fetched_at=at,
        )
        for side, delta in ((Side.BUY, BUY_DELTA), (Side.SELL, SELL_DELTA))
    )
    terms = PlatformTerms(
        platform_slug=slug,
        buy_fee_percent=Decimal("1"),
        sell_fee_percent=Decimal("1"),
        round_trip_percent=Decimal("2"),
        fee_source=FeeSource.MANUAL,
        buy_enabled=True,
        sell_enabled=True,
        observed_at=at,
    )
    return PlatformSnapshot(
        platform_slug=slug, quotes=quotes, terms=terms, fetched_at=at, suppressed=suppressed
    )


def make_reference(value: int, at: datetime) -> ReferenceSnapshot:
    quote = ReferenceQuote(
        reference_slug="talair",
        instrument=ReferenceInstrument.GOLD_18K_TOMAN,
        side=Side.MID,
        value=Decimal(value),
        raw_value=Decimal(value),
        raw_scale=Decimal(1),
        fetched_at=at,
    )
    return ReferenceSnapshot(
        reference_slug="talair",
        name_fa="طلا دات‌آی‌آر",
        source_url="https://www.tala.ir/",
        quotes=(quote,),
        fetched_at=at,
    )


async def seed(store: InMemoryStore, mids: list[tuple[int, datetime]]) -> None:
    for mid, at in mids:
        await store.save_snapshot(make_snapshot(mid, at))


async def test_rollup_builds_min_max_open_close_per_completed_hour() -> None:
    store = InMemoryStore()
    await seed(
        store,
        [
            # ساعت ۱۰ — چهار نوبت با نوسان
            (100_000, BASE),
            (100_500, BASE + timedelta(minutes=10)),
            (99_800, BASE + timedelta(minutes=20)),
            (100_200, BASE + timedelta(minutes=30)),
            # ساعت ۱۱ — یک نوبت
            (101_000, BASE + timedelta(hours=1, minutes=5)),
            # ساعت ۱۲ (جاری، ناقص) — نباید تجمیع شود
            (102_000, BASE + timedelta(hours=2, minutes=1)),
        ],
    )

    rollups = await rollup_completed_hours(store, now=BASE + timedelta(hours=2, minutes=30))

    by_key = {(r.side, r.hour_start): r for r in rollups}
    buy_10 = by_key[("BUY", BASE)]
    assert buy_10.open_value == 100_000 + BUY_DELTA
    assert buy_10.close_value == 100_200 + BUY_DELTA
    assert buy_10.min_value == 99_800 + BUY_DELTA
    assert buy_10.max_value == 100_500 + BUY_DELTA
    assert buy_10.sample_count == 4
    sell_10 = by_key[("SELL", BASE)]
    assert sell_10.min_value == 99_800 + SELL_DELTA
    assert sell_10.max_value == 100_500 + SELL_DELTA
    # ساعت ۱۱ تجمیع شده، ساعت جاری نه.
    assert ("BUY", BASE + timedelta(hours=1)) in by_key
    assert all(r.hour_start < BASE + timedelta(hours=2) for r in rollups)


async def test_rollup_rerun_is_idempotent() -> None:
    store = InMemoryStore()
    await seed(store, [(100_000, BASE), (100_500, BASE + timedelta(minutes=10))])
    now = BASE + timedelta(hours=1, minutes=30)

    await rollup_completed_hours(store, now=now)
    first = await store.get_hourly_rollups(SourceKind.PLATFORM, "wallgold")
    await rollup_completed_hours(store, now=now)
    second = await store.get_hourly_rollups(SourceKind.PLATFORM, "wallgold")

    assert first == second
    assert len(second) == 2  # فقط BUY و SELL همان یک ساعت — بدون ردیف تکراری


async def test_rollup_excludes_suppressed_rows() -> None:
    """ردیف سرکوب‌شده (رد چک میانه) هرگز نمایش داده نشده ⟸ وارد تجمیع نمی‌شود."""
    store = InMemoryStore()
    await seed(store, [(100_000, BASE), (100_200, BASE + timedelta(minutes=20))])
    # مقدار پرت سرکوب‌شده — نباید بیشینه را آلوده کند.
    await store.save_snapshot(
        make_snapshot(1_000_000, BASE + timedelta(minutes=10), suppressed=True)
    )

    rollups = await rollup_completed_hours(store, now=BASE + timedelta(hours=1, minutes=1))

    buy_10 = next(r for r in rollups if r.side == "BUY")
    assert buy_10.sample_count == 2
    assert buy_10.max_value == 100_200 + BUY_DELTA


async def test_reference_quotes_are_rolled_up() -> None:
    """مرجع قیمت هم جزو آرشیو حقوقی است (بند ۷.۱) — تجمیع می‌شود، با kind جدا."""
    store = InMemoryStore()
    await store.save_reference(make_reference(9_000_000, BASE))
    await store.save_reference(make_reference(9_100_000, BASE + timedelta(minutes=30)))

    await rollup_completed_hours(store, now=BASE + timedelta(hours=1, minutes=1))

    rollups = await store.get_hourly_rollups(SourceKind.REFERENCE, "talair")
    assert len(rollups) == 1
    rollup = rollups[0]
    assert rollup.instrument == "GOLD_18K_TOMAN"
    assert rollup.open_value == 9_000_000
    assert rollup.close_value == 9_100_000
    assert rollup.sample_count == 2


async def test_prune_only_after_rollup_of_same_interval() -> None:
    """معیار پذیرش: هرس فقط بعد از تجمیع موفق همان بازه — ساعت تجمیع‌نشده
    هر قدر هم کهنه باشد می‌ماند تا تجمیعش برسد."""
    store = InMemoryStore()
    await seed(
        store,
        [
            (100_000, BASE),  # ساعت ۱۰
            (101_000, BASE + timedelta(hours=1, minutes=5)),  # ساعت ۱۱
        ],
    )
    # تجمیع فقط تا پیش از ساعت ۱۱ — ساعت ۱۱ هنوز «جاری» است و تجمیع نمی‌شود.
    await rollup_completed_hours(store, now=BASE + timedelta(hours=1, minutes=30))

    later = BASE + timedelta(days=91)
    pruned = await prune_expired_raw(store, now=later)

    remaining = await store.load_raw_rows(until=FAR)
    assert pruned == 2  # دو سمتِ ساعتِ تجمیع‌شده‌ی ۱۰
    assert all(hour_floor(r.fetched_at) != BASE for r in remaining)
    # ساعت ۱۱ با اینکه ۹۱ روز کهنه است، بدون تجمیع هرس نشده.
    assert any(hour_floor(r.fetched_at) == BASE + timedelta(hours=1) for r in remaining)

    # جبران: تجمیعِ جامانده ⟸ حالا هرس مجاز است.
    await rollup_completed_hours(store, now=later)
    await prune_expired_raw(store, now=later)
    assert await store.load_raw_rows(until=FAR) == ()


async def test_prune_keeps_rows_inside_retention_window() -> None:
    store = InMemoryStore()
    fresh_at = BASE + timedelta(days=89)
    await seed(store, [(100_000, BASE), (105_000, fresh_at)])
    now = BASE + timedelta(days=90, hours=1)
    await rollup_completed_hours(store, now=now)  # هر دو ساعت تجمیع می‌شوند

    pruned = await prune_expired_raw(store, now=now)

    remaining = await store.load_raw_rows(until=FAR)
    assert pruned == 2  # فقط ردیف‌های ساعتِ ۹۰ روز پیش
    assert {r.fetched_at for r in remaining} == {fresh_at}


async def test_prune_never_touches_suppressed_rows() -> None:
    """ردیف سرکوب‌شده سندِ کارکردِ چک میانه است — هرگز هرس نمی‌شود
    (در تجمیع هم نیست، پس «تجمیع همان بازه» درباره‌اش معنا ندارد)."""
    store = InMemoryStore()
    await seed(store, [(100_000, BASE)])
    await store.save_snapshot(
        make_snapshot(1_000_000, BASE + timedelta(minutes=10), suppressed=True)
    )
    later = BASE + timedelta(days=91)
    await rollup_completed_hours(store, now=later)

    await prune_expired_raw(store, now=later)

    remaining = await store.load_raw_rows(until=FAR)
    assert len(remaining) == 2
    assert all(r.suppressed for r in remaining)


async def test_compression_keeps_first_and_last_of_each_run() -> None:
    """قرارداد فشرده‌سازی: از دنباله‌ی بی‌وقفه‌ی مقدار یکسان، اول و آخر
    می‌مانند — «چه قیمتی کی نمایش داده می‌شد» همچنان اثبات‌پذیر است."""
    store = InMemoryStore()
    run_times = [BASE + timedelta(minutes=m) for m in (0, 10, 20, 30)]
    await seed(store, [(100_000, at) for at in run_times])  # دنباله‌ی ثابت
    await seed(store, [(100_500, BASE + timedelta(minutes=40))])  # شکستن دنباله
    now = BASE + timedelta(hours=1, minutes=30)
    await rollup_completed_hours(store, now=now)

    removed = await compress_duplicate_runs(store, now=now)

    assert removed == 4  # دو ردیف میانی × دو سمت
    remaining = await store.load_raw_rows(until=FAR)
    buy_times = sorted(r.fetched_at for r in remaining if r.side == "BUY")
    assert buy_times == [run_times[0], run_times[-1], BASE + timedelta(minutes=40)]
    # بازاجرا دیگر چیزی برای حذف ندارد.
    assert await compress_duplicate_runs(store, now=now) == 0


async def test_compression_requires_rollup_of_the_hour() -> None:
    """فشرده‌سازی هم حذفِ خام است ⟸ همان دروازه‌ی هرس: بدون تجمیعِ موفقِ
    همان بازه هیچ ردیفی حذف نمی‌شود؛ ساعت جاریِ ناقص هم دست‌نخورده است."""
    store = InMemoryStore()
    await seed(store, [(100_000, BASE + timedelta(minutes=m)) for m in (0, 10, 20)])
    now = BASE + timedelta(hours=1, minutes=30)

    # بدون هیچ تجمیعی — هیچ حذفی مجاز نیست.
    assert await compress_duplicate_runs(store, now=now) == 0

    # تکراری‌های ساعتِ جاری حتی بعد از تجمیعِ ساعت‌های قبلی حذف نمی‌شوند.
    await rollup_completed_hours(store, now=now)
    await seed(
        store,
        [(100_000, BASE + timedelta(hours=1, minutes=m)) for m in (0, 5, 10)],
    )
    await compress_duplicate_runs(store, now=now)
    remaining = await store.load_raw_rows(until=FAR)
    current_hour_rows = [
        r for r in remaining if hour_floor(r.fetched_at) == BASE + timedelta(hours=1)
    ]
    assert len(current_hour_rows) == 6  # سه نوبت × دو سمت، دست‌نخورده


async def test_retention_pass_preserves_hourly_history_after_prune() -> None:
    """زنجیره‌ی دفاع حقوقی (بند ۷.۱): بعد از هرسِ خامِ کهنه، تاریخچه‌ی ساعتی
    کامل و منتسب باقی است و کوئری تاریخچه از همان می‌خواند."""
    store = InMemoryStore()
    await seed(
        store,
        [
            (100_000, BASE),
            (100_400, BASE + timedelta(minutes=20)),
            (100_100, BASE + timedelta(minutes=40)),
            (101_000, BASE + timedelta(hours=1, minutes=10)),
        ],
    )
    await store.save_reference(make_reference(9_000_000, BASE + timedelta(minutes=5)))
    later = BASE + timedelta(days=91)

    report = await retention_pass(store, now=later)

    # هر دو ساعتِ سکو (۲ سمت) + یک ساعتِ مرجع در همان گذر تجمیع و سپس هرس شدند.
    assert report.rollups_written == 5
    assert report.rows_pruned == 9
    assert await store.load_raw_rows(until=FAR) == ()
    history = await store.get_hourly_rollups(SourceKind.PLATFORM, "wallgold")
    assert [r.hour_start for r in history if r.side == "BUY"] == [
        BASE,
        BASE + timedelta(hours=1),
    ]
    buy_10 = next(r for r in history if r.side == "BUY" and r.hour_start == BASE)
    assert (buy_10.open_value, buy_10.close_value) == (
        100_000 + BUY_DELTA,
        100_100 + BUY_DELTA,
    )
    assert (await store.get_hourly_rollups(SourceKind.REFERENCE, "talair"))[
        0
    ].sample_count == 1
