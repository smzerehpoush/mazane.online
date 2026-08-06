"""مرز گردآورنده — نوبت چندمنبعی: چک میانه‌ی تقاطعی، کهنگی، فهرست عمومی.

همه‌ی payload ها فیکسچرهای واقعی ضبط‌شده‌اند؛ سناریوی «مقیاس غلط» با
دست‌کاری همان فیکسچر ساخته می‌شود. هیچ تماس شبکه‌ای نیست.
"""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from mazane_collector.adapters.goldika import GOLDIKA_ENDPOINT, GoldikaAdapter
from mazane_collector.adapters.milli import MILLI_ENDPOINT, MilliAdapter
from mazane_collector.adapters.talasea import TALASEA_ENDPOINT, TalaseaAdapter
from mazane_collector.adapters.wallgold import WALLGOLD_ENDPOINT, WallgoldAdapter
from mazane_collector.pipeline import collect_round
from mazane_collector.platforms import PLATFORMS
from mazane_collector.store.memory import InMemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)

ALL_ADAPTERS = (WallgoldAdapter(), TalaseaAdapter(), MilliAdapter(), GoldikaAdapter())


def load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def all_payloads() -> dict[str, Any]:
    return {
        WALLGOLD_ENDPOINT: load("wallgold_markets.json"),
        TALASEA_ENDPOINT: load("talasea_gold_price.json"),
        MILLI_ENDPOINT: load("milli_price_external.json"),
        GOLDIKA_ENDPOINT: load("goldika_v2_price.json"),
    }


def make_fetcher(payloads: dict[str, Any]) -> Any:
    async def fetch_json(url: str) -> Any:
        value = payloads[url]
        if isinstance(value, Exception):
            raise value
        return value

    return fetch_json


async def test_healthy_round_publishes_all_four_sources() -> None:
    store = InMemoryStore()

    saved = await collect_round(
        ALL_ADAPTERS, make_fetcher(all_payloads()), store, platforms=PLATFORMS, now=FETCHED_AT
    )

    assert len(saved) == 4
    assert all(not snapshot.suppressed for snapshot in saved)
    for slug in ("wallgold", "talasea", "milli", "goldika"):
        assert await store.get_snapshot(slug) is not None
        assert await store.get_updated_at(slug) == FETCHED_AT


async def test_wrong_scale_source_is_suppressed_with_warning(
    caplog: Any,
) -> None:
    """قاعده‌ی ۳ قراردادها: انحراف >۰٫۵٪ از میانه‌ی سایر منابع ⟸ عدم انتشار
    + هشدار؛ ولی در تاریخچه با پرچم سرکوب ثبت می‌شود."""
    payloads = all_payloads()
    # مقیاس غلط: mid_price گلدیکا ده برابر (انگار ضریب ÷۱۰ فراموش شده باشد).
    payloads[GOLDIKA_ENDPOINT]["data"]["mid_price"] = 1851423500
    store = InMemoryStore()

    with caplog.at_level(logging.WARNING, logger="mazane.collector.pipeline"):
        await collect_round(
            ALL_ADAPTERS, make_fetcher(payloads), store, platforms=PLATFORMS, now=FETCHED_AT
        )

    # منتشر نشد: نه قیمت جاری، نه updated_at.
    assert await store.get_snapshot("goldika") is None
    assert await store.get_updated_at("goldika") is None

    # ولی در تاریخچه با پرچم سرکوب ثبت شد (آرشیو الزام حقوقی است — بند ۷.۱).
    goldika_history = [s for s in store.history if s.platform_slug == "goldika"]
    assert len(goldika_history) == 1
    assert goldika_history[0].suppressed is True

    # هشدار در لاگ.
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any("goldika" in r.getMessage() for r in warnings)

    # سایر منابع سالم منتشر شدند.
    for slug in ("wallgold", "talasea", "milli"):
        assert await store.get_snapshot(slug) is not None


async def test_median_check_skipped_with_fewer_than_three_fresh_sources() -> None:
    """با کمتر از ۳ منبع تازه رأی‌گیری ممکن نیست — حتی عدد پرت هم منتشر می‌شود."""
    payloads = all_payloads()
    payloads[GOLDIKA_ENDPOINT]["data"]["mid_price"] = 1851423500  # پرت
    store = InMemoryStore()

    await collect_round(
        (WallgoldAdapter(), GoldikaAdapter()),
        make_fetcher(payloads),
        store,
        platforms=PLATFORMS,
        now=FETCHED_AT,
    )

    assert await store.get_snapshot("wallgold") is not None
    assert await store.get_snapshot("goldika") is not None


async def test_dead_source_does_not_break_the_round() -> None:
    """قطع منبع ⟸ کهنگی، نه خطا: بقیه‌ی نوبت کامل می‌شود."""
    payloads = all_payloads()
    payloads[MILLI_ENDPOINT] = RuntimeError("connection refused")
    store = InMemoryStore()

    saved = await collect_round(
        ALL_ADAPTERS, make_fetcher(payloads), store, platforms=PLATFORMS, now=FETCHED_AT
    )

    assert {s.platform_slug for s in saved} == {"wallgold", "talasea", "goldika"}
    assert await store.get_snapshot("milli") is None
    assert await store.get_updated_at("milli") is None
    assert await store.get_snapshot("wallgold") is not None


async def test_goldika_is_stored_but_never_listed() -> None:
    """گلدیکا `PERMISSION_PENDING` است: کرال و ذخیره می‌شود ولی در فهرستی که
    وب می‌خواند نیست — اجرای قید در داده، نه با فیلتر در وب (بند ۱۲.۳)."""
    store = InMemoryStore()

    await collect_round(
        ALL_ADAPTERS, make_fetcher(all_payloads()), store, platforms=PLATFORMS, now=FETCHED_AT
    )

    # در استور هست…
    assert await store.get_snapshot("goldika") is not None
    # …ولی در فهرست عمومی نیست.
    listed = await store.get_listed_platforms()
    assert {p.slug for p in listed} == {"wallgold", "talasea", "milli"}
    assert all(p.is_listed for p in listed)
