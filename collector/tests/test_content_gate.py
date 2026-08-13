from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from tablo_collector.content.gate import (
    SIMILARITY_THRESHOLD,
    DataGapError,
    DigitOutsideSlotError,
    NearDuplicateError,
    UnfilledSlotError,
    has_data_gap,
    render_draft,
    similarity,
    validate_draft,
)
from tablo_collector.content.queue import enqueue_draft
from tablo_collector.retention import HourlyRollup, SourceKind, hour_floor
from tablo_collector.store.memory import InMemoryStore

from test_content_queue import BASE, FakeContentGateway

BODY_TEMPLATE = (
    "کارمزد خرید وال‌گلد {{karmozd_wallgold}} و کارمزد خرید طلاسی "
    "{{karmozd_talasea}} است. کمترین کارمزد این سنجش مال {{arzantarin}} شد "
    "و فاصله‌ی سکوها چندان چشمگیر نیست؛ پیش از هر خرید هزینه‌ی مؤثر را "
    "با هم بسنجید."
)
SLOTS = {
    "karmozd_wallgold": "۰٫۷۵ درصد",
    "karmozd_talasea": "۱ درصد",
    "arzantarin": "وال‌گلد",
}


async def test_enqueue_rejects_persian_digit_outside_slot() -> None:
    gateway = FakeContentGateway()

    with pytest.raises(DigitOutsideSlotError):
        await enqueue_draft(
            gateway,
            slug="karmozd-ha",
            title_template="کارمزدها",
            body_template="کارمزد خرید وال‌گلد ۰٫۷۵ درصد است.",
            now=BASE,
        )
    assert await gateway.all_slugs() == frozenset()


async def test_enqueue_rejects_latin_digit_outside_slot() -> None:
    gateway = FakeContentGateway()

    with pytest.raises(DigitOutsideSlotError):
        await enqueue_draft(
            gateway,
            slug="karmozd-ha",
            title_template="کارمزدها",
            body_template="کارمزد خرید وال‌گلد 0.75 درصد است.",
            now=BASE,
        )
    assert await gateway.all_slugs() == frozenset()


async def test_enqueue_rejects_digit_in_title_template() -> None:
    gateway = FakeContentGateway()

    with pytest.raises(DigitOutsideSlotError):
        await enqueue_draft(
            gateway,
            slug="tala-18-ayar",
            title_template="طلای ۱۸ عیار",
            body_template="متن بدون رقم.",
            now=BASE,
        )
    assert await gateway.all_slugs() == frozenset()


def test_arabic_digit_is_also_rejected() -> None:
    with pytest.raises(DigitOutsideSlotError):
        validate_draft("قیمت ٥ تومان شد.", {}, (), data_ok=True)


def test_digits_are_allowed_only_via_slot_values() -> None:
    rendered = validate_draft(BODY_TEMPLATE, SLOTS, (), data_ok=True)

    assert "۰٫۷۵ درصد" in rendered
    assert "{{" not in rendered


def test_unfilled_slot_rejected() -> None:
    with pytest.raises(UnfilledSlotError):
        validate_draft(BODY_TEMPLATE, {"karmozd_wallgold": "۰٫۷۵ درصد"}, (), data_ok=True)


def test_malformed_placeholder_rejected_not_leaked() -> None:
    with pytest.raises(UnfilledSlotError):
        render_draft("کارمزد {{Fee}} است.", {"fee": "۱ درصد"})


def test_render_fills_slots_from_data() -> None:
    rendered = render_draft("کارمزد {{fee}} است.", {"fee": "۰٫۷۵ درصد"})

    assert rendered == "کارمزد ۰٫۷۵ درصد است."


def test_data_gap_flag_rejects_draft() -> None:
    with pytest.raises(DataGapError):
        validate_draft(BODY_TEMPLATE, SLOTS, (), data_ok=False)


async def test_enqueue_rejects_when_data_ok_false_nothing_inserted() -> None:
    gateway = FakeContentGateway()

    with pytest.raises(DataGapError):
        await enqueue_draft(
            gateway,
            slug="karmozd-ha",
            title_template="کارمزدها",
            body_template=BODY_TEMPLATE,
            slots=SLOTS,
            data_ok=False,
            now=BASE,
        )
    assert await gateway.all_slugs() == frozenset()


def _rollup(slug: str, hour: datetime, *, instrument: str = "GOLD_18K") -> HourlyRollup:
    return HourlyRollup(
        kind=SourceKind.PLATFORM,
        source_slug=slug,
        instrument=instrument,
        side="BUY",
        hour_start=hour,
        open_value=Decimal(1),
        close_value=Decimal(1),
        min_value=Decimal(1),
        max_value=Decimal(1),
        sample_count=1,
    )


def _hours(since: datetime, until: datetime) -> list[datetime]:
    hours = []
    hour = hour_floor(since)
    while hour < hour_floor(until):
        hours.append(hour)
        hour += timedelta(hours=1)
    return hours


async def test_has_data_gap_false_when_every_hour_is_rolled_up() -> None:
    store = InMemoryStore()
    since, until = BASE - timedelta(hours=24), BASE
    await store.upsert_rollups(
        [_rollup(slug, hour) for slug in ("wallgold", "talasea") for hour in _hours(since, until)]
    )

    gap = await has_data_gap(
        store,
        platform_slugs=("wallgold", "talasea"),
        instrument="GOLD_18K",
        since=since,
        until=until,
    )

    assert gap is False


async def test_has_data_gap_true_when_any_platform_misses_an_hour() -> None:
    store = InMemoryStore()
    since, until = BASE - timedelta(hours=24), BASE
    hours = _hours(since, until)
    missing = hours[len(hours) // 2]
    rollups = [_rollup("wallgold", hour) for hour in hours]
    rollups += [_rollup("talasea", hour) for hour in hours if hour != missing]
    await store.upsert_rollups(rollups)

    gap = await has_data_gap(
        store,
        platform_slugs=("wallgold", "talasea"),
        instrument="GOLD_18K",
        since=since,
        until=until,
    )

    assert gap is True


async def test_has_data_gap_ignores_other_instruments() -> None:
    store = InMemoryStore()
    since, until = BASE - timedelta(hours=24), BASE
    await store.upsert_rollups(
        [_rollup("wallgold", hour, instrument="SILVER_990") for hour in _hours(since, until)]
    )

    gap = await has_data_gap(
        store,
        platform_slugs=("wallgold",),
        instrument="GOLD_18K",
        since=since,
        until=until,
    )

    assert gap is True


def test_similarity_measure_sanity() -> None:
    other = (
        "تحویل فیزیکی شمش در بیشتر سکوها هنوز شفاف نیست و هر کدام قاعده‌ی "
        "خودشان را دارند؛ پیش از تصمیم، شرایط تحویل را از خود سکو بپرسید."
    )
    rendered = render_draft(BODY_TEMPLATE, SLOTS)

    assert similarity(rendered, rendered) == 1.0
    assert similarity(rendered, other) < SIMILARITY_THRESHOLD


async def test_near_duplicate_accepted_first_time_rejected_second_time() -> None:
    gateway = FakeContentGateway()
    await enqueue_draft(
        gateway,
        slug="karmozd-ha",
        title_template="کارمزدها",
        body_template=BODY_TEMPLATE,
        slots=SLOTS,
        now=BASE,
    )

    fresh_slots = {
        "karmozd_wallgold": "۰٫۸ درصد",
        "karmozd_talasea": "۰٫۹ درصد",
        "arzantarin": "طلاسی",
    }
    with pytest.raises(NearDuplicateError):
        await enqueue_draft(
            gateway,
            slug="karmozd-ha-dobare",
            title_template="کارمزدها دوباره",
            body_template=BODY_TEMPLATE,
            slots=fresh_slots,
            now=BASE + timedelta(days=1),
        )

    await enqueue_draft(
        gateway,
        slug="tahvil-fiziki",
        title_template="تحویل فیزیکی",
        body_template=(
            "تحویل فیزیکی شمش در بیشتر سکوها هنوز شفاف نیست و هر کدام "
            "قاعده‌ی خودشان را دارند؛ شرایط {{sako}} مستند است."
        ),
        slots={"sako": "میلی"},
        now=BASE + timedelta(days=1),
    )

    assert await gateway.all_slugs() == frozenset({"karmozd-ha", "tahvil-fiziki"})
