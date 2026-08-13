from datetime import UTC, datetime, timedelta
from decimal import Decimal

from tablo_collector.models import (
    FeeSource,
    Instrument,
    PlatformSnapshot,
    PlatformTerms,
    Quote,
    Side,
)
from tablo_collector.references import (
    ReferenceInstrument,
    ReferenceQuote,
    ReferenceSnapshot,
)
from tablo_collector.retention import (
    SourceKind,
    compress_duplicate_runs,
    hour_floor,
    prune_expired_raw,
    retention_pass,
    rollup_completed_hours,
)
from tablo_collector.store.memory import InMemoryStore

BASE = datetime(2026, 1, 15, 10, 0, 0, tzinfo=UTC)
FAR = BASE + timedelta(days=365)

SIDES_PER_SNAPSHOT = 1


def make_snapshot(
    mid: int,
    at: datetime,
    *,
    slug: str = "wallgold",
    suppressed: bool = False,
) -> PlatformSnapshot:
    quotes = (
        Quote(
            platform_slug=slug,
            instrument=Instrument.GOLD_18K,
            side=Side.PRICE,
            price_toman=mid,
            raw_value=Decimal(mid),
            raw_scale=Decimal(1),
            fetched_at=at,
        ),
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
        side=Side.PRICE,
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
            (100_000, BASE),
            (100_500, BASE + timedelta(minutes=10)),
            (99_800, BASE + timedelta(minutes=20)),
            (100_200, BASE + timedelta(minutes=30)),
            (101_000, BASE + timedelta(hours=1, minutes=5)),
            (102_000, BASE + timedelta(hours=2, minutes=1)),
        ],
    )

    rollups = await rollup_completed_hours(store, now=BASE + timedelta(hours=2, minutes=30))

    by_key = {(r.side, r.hour_start): r for r in rollups}
    hour_10 = by_key[("PRICE", BASE)]
    assert hour_10.open_value == 100_000
    assert hour_10.close_value == 100_200
    assert hour_10.min_value == 99_800
    assert hour_10.max_value == 100_500
    assert hour_10.sample_count == 4
    assert ("PRICE", BASE + timedelta(hours=1)) in by_key
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
    assert len(second) == SIDES_PER_SNAPSHOT


async def test_rollup_excludes_suppressed_rows() -> None:
    store = InMemoryStore()
    await seed(store, [(100_000, BASE), (100_200, BASE + timedelta(minutes=20))])
    await store.save_snapshot(
        make_snapshot(1_000_000, BASE + timedelta(minutes=10), suppressed=True)
    )

    rollups = await rollup_completed_hours(store, now=BASE + timedelta(hours=1, minutes=1))

    hour_10 = next(r for r in rollups if r.side == "PRICE")
    assert hour_10.sample_count == 2
    assert hour_10.max_value == 100_200


async def test_reference_quotes_are_rolled_up() -> None:
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
    store = InMemoryStore()
    await seed(
        store,
        [
            (100_000, BASE),
            (101_000, BASE + timedelta(hours=1, minutes=5)),
        ],
    )
    await rollup_completed_hours(store, now=BASE + timedelta(hours=1, minutes=30))

    later = BASE + timedelta(days=91)
    pruned = await prune_expired_raw(store, now=later)

    remaining = await store.load_raw_rows(until=FAR)
    assert pruned == SIDES_PER_SNAPSHOT
    assert all(hour_floor(r.fetched_at) != BASE for r in remaining)
    assert any(hour_floor(r.fetched_at) == BASE + timedelta(hours=1) for r in remaining)

    await rollup_completed_hours(store, now=later)
    await prune_expired_raw(store, now=later)
    assert await store.load_raw_rows(until=FAR) == ()


async def test_prune_keeps_rows_inside_retention_window() -> None:
    store = InMemoryStore()
    fresh_at = BASE + timedelta(days=89)
    await seed(store, [(100_000, BASE), (105_000, fresh_at)])
    now = BASE + timedelta(days=90, hours=1)
    await rollup_completed_hours(store, now=now)

    pruned = await prune_expired_raw(store, now=now)

    remaining = await store.load_raw_rows(until=FAR)
    assert pruned == SIDES_PER_SNAPSHOT
    assert {r.fetched_at for r in remaining} == {fresh_at}


async def test_prune_never_touches_suppressed_rows() -> None:
    store = InMemoryStore()
    await seed(store, [(100_000, BASE)])
    await store.save_snapshot(
        make_snapshot(1_000_000, BASE + timedelta(minutes=10), suppressed=True)
    )
    later = BASE + timedelta(days=91)
    await rollup_completed_hours(store, now=later)

    await prune_expired_raw(store, now=later)

    remaining = await store.load_raw_rows(until=FAR)
    assert len(remaining) == SIDES_PER_SNAPSHOT
    assert all(r.suppressed for r in remaining)


async def test_compression_keeps_first_and_last_of_each_run() -> None:
    store = InMemoryStore()
    run_times = [BASE + timedelta(minutes=m) for m in (0, 10, 20, 30)]
    await seed(store, [(100_000, at) for at in run_times])
    await seed(store, [(100_500, BASE + timedelta(minutes=40))])
    now = BASE + timedelta(hours=1, minutes=30)
    await rollup_completed_hours(store, now=now)

    removed = await compress_duplicate_runs(store, now=now)

    assert removed == 2 * SIDES_PER_SNAPSHOT
    remaining = await store.load_raw_rows(until=FAR)
    buy_times = sorted(r.fetched_at for r in remaining if r.side == "PRICE")
    assert buy_times == [run_times[0], run_times[-1], BASE + timedelta(minutes=40)]
    assert await compress_duplicate_runs(store, now=now) == 0


async def test_compression_requires_rollup_of_the_hour() -> None:
    store = InMemoryStore()
    await seed(store, [(100_000, BASE + timedelta(minutes=m)) for m in (0, 10, 20)])
    now = BASE + timedelta(hours=1, minutes=30)

    assert await compress_duplicate_runs(store, now=now) == 0

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
    assert len(current_hour_rows) == 3 * SIDES_PER_SNAPSHOT


async def test_retention_pass_preserves_hourly_history_after_prune() -> None:
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

    assert report.rollups_written == 2 * SIDES_PER_SNAPSHOT + 1
    assert report.rows_pruned == 4 * SIDES_PER_SNAPSHOT + 1
    assert await store.load_raw_rows(until=FAR) == ()
    history = await store.get_hourly_rollups(SourceKind.PLATFORM, "wallgold")
    assert [r.hour_start for r in history if r.side == "PRICE"] == [
        BASE,
        BASE + timedelta(hours=1),
    ]
    hour_10 = next(r for r in history if r.side == "PRICE" and r.hour_start == BASE)
    assert (hour_10.open_value, hour_10.close_value) == (100_000, 100_100)
    assert (await store.get_hourly_rollups(SourceKind.REFERENCE, "talair"))[
        0
    ].sample_count == 1
