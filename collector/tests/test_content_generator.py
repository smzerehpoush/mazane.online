"""مرز گردآورنده — مولد لپ‌تاپ + دروازه (بلیت ۱۴؛ بند ۱۳، تصمیم‌های ۱۶–۱۷).

کل خط لوله با فیک‌ها اجرا می‌شود: `InMemoryStore` (اسنپ‌شات‌ها + rollup ها)،
`FakeContentGateway` (جدول posts) و `FakeLlmClient` (جمینای) — هیچ تماس
شبکه‌ای نیست و کلیدی لازم نیست.

معیارهای پذیرش بلیت:
- اجرای مولد چند پیش‌نویس معتبر به صف می‌فرستد (پنج موضوع لانچ).
- هیچ عدد نمایشی از خروجی مدل نمی‌آید — هر رقمِ متنِ صف‌شده از مقدار
  جای‌خالی (کوئری داده) است؛ نثرِ رقم‌دار مدل پشت دروازه رد می‌شود.
- برای دوره‌ی دارای گپ داده اصلاً تولید نمی‌شود (LLM حتی صدا نمی‌خورد).
- پرامپت‌ها دستور «هیچ رقمی ننویس» و جای‌خالی‌ها را حمل می‌کنند.
- بدون GEMINI_API_KEY فرمان با پیام روشن می‌ایستد (بدون traceback).
"""

import re
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest

from tablo_collector.content.generator import (
    GAP_INSTRUMENT,
    GAP_LOOKBACK,
    MECHANICAL_MODEL,
    NO_DIGITS_INSTRUCTION,
    PROSE_MODEL,
    TOPIC_BUILDERS,
    FakeLlmClient,
    GeminiClient,
    generate_launch_drafts,
)
from tablo_collector.content.generator import main as generate_main
from tablo_collector.models import (
    DataPolicy,
    FeeSource,
    Instrument,
    Platform,
    PlatformSnapshot,
    PlatformTerms,
    Quote,
    Side,
)
from tablo_collector.retention import HourlyRollup, SourceKind, hour_floor
from tablo_collector.store.memory import InMemoryStore

from test_content_queue import FakeContentGateway

# ظهرِ یک روز دلخواه — همه‌ی زمان‌ها تزریقی‌اند، ساعت سیستم بی‌اثر است.
NOW = datetime(2026, 8, 6, 12, 30, 0, tzinfo=UTC)


def _platform(slug: str, name_fa: str, delivery_note_fa: str | None = None) -> Platform:
    return Platform(
        slug=slug,
        name_fa=name_fa,
        data_policy=DataPolicy.ALLOWED,
        delivery_note_fa=delivery_note_fa,
    )


PLATFORMS = (
    _platform("wallgold", "وال‌گلد"),
    _platform("talasea", "طلاسی", "تحویل فیزیکی با اجرت ساخت (نرخ اعلام عمومی نشده)"),
    _platform("milli", "میلی", "کارمزد تحویل فیزیکی ۳٪"),
)


def _snapshot(
    slug: str,
    buy_fee: str,
    sell_fee: str,
    round_trip: str,
    *,
    min_order_toman: int | None = None,
    sell_enabled: bool = True,
) -> PlatformSnapshot:
    quotes = (
        Quote(
            platform_slug=slug,
            instrument=Instrument.GOLD_18K,
            side=Side.PRICE,
            price_toman=1_000_000,
            raw_value=Decimal(1),
            raw_scale=Decimal(1),
            fetched_at=NOW,
        ),
    )
    terms = PlatformTerms(
        platform_slug=slug,
        buy_fee_percent=Decimal(buy_fee),
        sell_fee_percent=Decimal(sell_fee),
        round_trip_percent=Decimal(round_trip),
        fee_source=FeeSource.MANUAL,
        buy_enabled=True,
        sell_enabled=sell_enabled,
        observed_at=NOW,
        min_order_toman=min_order_toman,
    )
    return PlatformSnapshot(platform_slug=slug, quotes=quotes, terms=terms, fetched_at=NOW)


SNAPSHOTS = {
    "wallgold": _snapshot("wallgold", "0.75", "0.75", "1.49", min_order_toman=100_000),
    "talasea": _snapshot("talasea", "1", "1", "1.98", min_order_toman=500_000, sell_enabled=False),
    "milli": _snapshot("milli", "0.5", "1.2", "1.69"),
}


def _rollup(slug: str, hour: datetime) -> HourlyRollup:
    return HourlyRollup(
        kind=SourceKind.PLATFORM,
        source_slug=slug,
        instrument=GAP_INSTRUMENT,
        side="BUY",
        hour_start=hour,
        open_value=Decimal(1),
        close_value=Decimal(1),
        min_value=Decimal(1),
        max_value=Decimal(1),
        sample_count=1,
    )


def _coverage_hours() -> list[datetime]:
    hours = []
    hour = hour_floor(NOW - GAP_LOOKBACK)
    while hour < hour_floor(NOW):
        hours.append(hour)
        hour += timedelta(hours=1)
    return hours


async def make_store(*, gap_platform: str | None = None) -> InMemoryStore:
    """استور کامل: سکوها + اسنپ‌شات‌ها + rollup پیوسته‌ی ۲۴ ساعته؛
    `gap_platform` یک ساعت از پوشش آن سکو را حذف می‌کند (گپ عمدی)."""
    store = InMemoryStore()
    await store.save_platforms(PLATFORMS)
    for snapshot in SNAPSHOTS.values():
        await store.save_snapshot(snapshot)
    hours = _coverage_hours()
    missing = hours[len(hours) // 2]
    rollups = [
        _rollup(platform.slug, hour)
        for platform in PLATFORMS
        for hour in hours
        if not (platform.slug == gap_platform and hour == missing)
    ]
    await store.upsert_rollups(rollups)
    return store


def _specs_by_slug() -> dict[str, dict[str, str]]:
    """بازساخت نقشه‌ی جای‌خالی هر موضوع — سازنده‌ها توابع خالص‌اند."""
    return {
        spec.slug: spec.slots
        for spec in (builder(PLATFORMS, SNAPSHOTS, NOW) for _, builder in TOPIC_BUILDERS)
    }


# ------------------------------------------------------------ خط لوله‌ی کامل


async def test_generator_enqueues_five_gated_drafts() -> None:
    """معیار پذیرش: اجرای مولد چند پیش‌نویس معتبر صف می‌کند — پنج موضوع لانچ،
    همه از مسیر گیت‌شده، همه رندرشده و بی‌جای‌خالیِ باقی‌مانده."""
    store = await make_store()
    gateway = FakeContentGateway()
    llm = FakeLlmClient()

    enqueued = await generate_launch_drafts(
        store=store, retention=store, gateway=gateway, llm=llm, now=NOW
    )

    assert len(enqueued) == 5
    assert await gateway.draft_count() == 5
    for slug in enqueued:
        post = gateway.posts[slug]
        assert post.status == "draft"
        assert "{{" not in post.body_md and "{{" not in post.title_fa


async def test_every_digit_in_queued_drafts_comes_from_slots() -> None:
    """معیار پذیرش: هیچ عدد نمایشی از خروجی مدل نمی‌آید — با حذف مقادیر
    جای‌خالی‌ها از متنِ صف‌شده هیچ رقمی (به هر خط) باقی نمی‌ماند."""
    store = await make_store()
    gateway = FakeContentGateway()

    enqueued = await generate_launch_drafts(
        store=store, retention=store, gateway=gateway, llm=FakeLlmClient(), now=NOW
    )

    slots_by_slug = _specs_by_slug()
    for slug in enqueued:
        post = gateway.posts[slug]
        text = f"{post.title_fa}\n{post.body_md}"
        assert re.search(r"\d", text), "پست داده‌محور باید عدد (از جای‌خالی) داشته باشد"
        remaining = text
        for value in slots_by_slug[slug].values():
            remaining = remaining.replace(value, " ")
        assert re.search(r"\d", remaining) is None, (
            f"رقمی بیرون از مقادیر جای‌خالی در {slug} ماند: {remaining!r}"
        )


async def test_prompts_instruct_no_digits_and_carry_placeholders() -> None:
    """پرامپت نثر و متا هر دو دستور «هیچ رقمی ننویس» و جای‌خالی‌ها را دارند
    و مدل‌ها همان دو مدل تصمیم ۱۷ اند (نثر اصلی، متا سبک)."""
    store = await make_store()
    llm = FakeLlmClient()

    await generate_launch_drafts(
        store=store, retention=store, gateway=FakeContentGateway(), llm=llm, now=NOW
    )

    assert len(llm.prompts) == 10  # ‏۵ موضوع × (نثر + متا)
    models = [model for model, _ in llm.prompts]
    assert models == [PROSE_MODEL, MECHANICAL_MODEL] * 5
    for _, prompt in llm.prompts:
        assert NO_DIGITS_INSTRUCTION in prompt
        assert "{{tarikh}}" in prompt
        assert re.search(r"\d", prompt.replace("۰-۹", "").replace("0-9", "")) is None, (
            "پرامپت نباید عدد داده‌ای بدهد که مدل وسوسه شود بازگویش کند"
        )


async def test_data_gap_blocks_generation_before_llm() -> None:
    """معیار پذیرش: دوره‌ی دارای گپ ⟸ پست تولید نمی‌شود. گپ در وال‌گلد همه‌ی
    موضوع‌های ارجاع‌دهنده به آن را می‌بندد — LLM برایشان اصلاً صدا نمی‌خورد؛
    تنها موضوعِ بی‌ارجاع به وال‌گلد (تحویل فیزیکی: طلاسی + میلی) می‌گذرد."""
    store = await make_store(gap_platform="wallgold")
    gateway = FakeContentGateway()
    llm = FakeLlmClient()

    enqueued = await generate_launch_drafts(
        store=store, retention=store, gateway=gateway, llm=llm, now=NOW
    )

    assert enqueued == (f"hazine-tahvil-fiziki-sakoha-{NOW:%Y%m%d}",)
    assert len(llm.prompts) == 2  # فقط نثر + متای همان یک موضوع


async def test_model_prose_with_digits_is_rejected_at_the_gate() -> None:
    """معیار پذیرش (نمایش خودکارشده): مدلی که رقم بنویسد پشت دروازه می‌ماند —
    موضوع اول با نثر رقم‌دارِ اسکریپت‌شده رد می‌شود، بقیه صف می‌شوند."""
    store = await make_store()
    gateway = FakeContentGateway()
    llm = FakeLlmClient(scripted=["قیمت طلا امروز ۵ درصد بالا رفت و به 1200 رسید."])

    enqueued = await generate_launch_drafts(
        store=store, retention=store, gateway=gateway, llm=llm, now=NOW
    )

    fee_slug = f"moqayese-karmozd-sakoha-{NOW:%Y%m%d}"
    assert fee_slug not in enqueued
    assert fee_slug not in gateway.posts
    assert len(enqueued) == 4


async def test_second_run_same_day_enqueues_nothing_new() -> None:
    """اجرای دوباره در همان روز پست تکراری نمی‌سازد: برخورد اسلاگ/شباهت
    پشت دروازه می‌ماند و اجرای اول دست‌نخورده است."""
    store = await make_store()
    gateway = FakeContentGateway()
    first = await generate_launch_drafts(
        store=store, retention=store, gateway=gateway, llm=FakeLlmClient(), now=NOW
    )

    second = await generate_launch_drafts(
        store=store, retention=store, gateway=gateway, llm=FakeLlmClient(), now=NOW
    )

    assert len(first) == 5
    assert second == ()
    assert await gateway.draft_count() == 5


async def test_without_any_data_nothing_is_generated() -> None:
    """داده‌ی ناکافی ⟸ موضوع‌ها بی‌سروصدا رد می‌شوند؛ LLM هرگز صدا نمی‌خورد
    («کهنگی، نه خطا» — پست جعلی ساخته نمی‌شود)."""
    store = InMemoryStore()
    await store.save_platforms(
        (_platform("wallgold", "وال‌گلد"), _platform("talasea", "طلاسی"))
    )  # نه اسنپ‌شاتی، نه یادداشت تحویلی
    llm = FakeLlmClient()

    enqueued = await generate_launch_drafts(
        store=store, retention=store, gateway=FakeContentGateway(), llm=llm, now=NOW
    )

    assert enqueued == ()
    assert llm.prompts == []


# --------------------------------------------------------- کلاینت جمینای


async def test_gemini_client_keeps_key_out_of_url_and_parses_text() -> None:
    """کلید فقط در هدر می‌رود (نشت در URL/لاگ خطا ممنوع) و پاسخ متنی
    candidates پارس می‌شود؛ repr هم کلید را نقاب می‌زند."""
    seen: dict[str, str | None] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("x-goog-api-key")
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "نثر آزمایشی"}]}}]},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = GeminiClient("raz-mahali-kelid", http=http)
        text = await client.generate("پرامپت", model=PROSE_MODEL)

    assert text == "نثر آزمایشی"
    assert seen["key"] == "raz-mahali-kelid"
    assert "raz-mahali-kelid" not in str(seen["url"])
    assert PROSE_MODEL in str(seen["url"])
    assert "raz" not in repr(client) and "****" in repr(client)


# ------------------------------------------------------------- فرمان CLI


def test_cli_without_api_key_fails_gracefully(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """معیار قرارداد: بدون GEMINI_API_KEY خطای فارسی روشن، خروج تمیز (کد ۲)،
    بدون traceback — پیش از هر تماس پایگاه/شبکه."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(sys, "argv", ["tablo-generate"])

    with pytest.raises(SystemExit) as excinfo:
        generate_main()

    assert excinfo.value.code == 2
    err = capsys.readouterr().err
    assert "GEMINI_API_KEY" in err
    assert "--fake" in err  # راه تمرین آفلاین را هم نشان می‌دهد


def test_cli_rejects_unknown_arguments(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["tablo-generate", "--chert"])

    with pytest.raises(SystemExit) as excinfo:
        generate_main()

    assert excinfo.value.code == 2
    assert "کاربرد" in capsys.readouterr().err
