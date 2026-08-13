from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from datetime import datetime, timedelta

from ..retention import RetentionStore, SourceKind, hour_floor

SIMILARITY_THRESHOLD = 0.5

SLOT_PATTERN = re.compile(r"\{\{([a-z][a-z0-9_]*)\}\}")

_ANY_DIGIT = re.compile(r"\d")

_NON_WORD = re.compile(r"\W+")


class DraftRejected(ValueError):
    pass


class DigitOutsideSlotError(DraftRejected):
    pass


class UnfilledSlotError(DraftRejected):
    pass


class DataGapError(DraftRejected):
    pass


class NearDuplicateError(DraftRejected):
    pass


def render_draft(template: str, slots: Mapping[str, str]) -> str:
    def fill(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in slots:
            raise UnfilledSlotError(f"جای‌خالی {{{{{name}}}}} مقدار ندارد — پیش‌نویس رد شد")
        return slots[name]

    rendered = SLOT_PATTERN.sub(fill, template)
    if "{{" in rendered or "}}" in rendered:
        raise UnfilledSlotError(
            "پس از پر شدن جای‌خالی‌ها هنوز «{{» یا «}}» در متن هست — "
            "جای‌خالی بدقواره یا مقدار آلوده؛ پیش‌نویس رد شد"
        )
    return rendered


def _reject_digits(template: str, *, where: str) -> None:
    stripped = SLOT_PATTERN.sub(" ", template)
    offender = _ANY_DIGIT.search(stripped)
    if offender is not None:
        raise DigitOutsideSlotError(
            f"رقم {offender.group(0)!r} بیرون از جای‌خالی در {where} — "
            "هیچ رقمی از مدل پذیرفته نمی‌شود (تصمیم ۱۶)"
        )


def _normalize(text: str) -> str:
    return _NON_WORD.sub(" ", text).casefold().strip()


def _trigrams(text: str) -> frozenset[str]:
    normalized = _normalize(text)
    return frozenset(normalized[i : i + 3] for i in range(len(normalized) - 2))


def similarity(first: str, second: str) -> float:
    grams_first, grams_second = _trigrams(first), _trigrams(second)
    if not grams_first and not grams_second:
        return 1.0 if _normalize(first) == _normalize(second) else 0.0
    if not grams_first or not grams_second:
        return 0.0
    return len(grams_first & grams_second) / len(grams_first | grams_second)


def validate_draft(
    template: str,
    slots: Mapping[str, str],
    existing_posts: Iterable[tuple[str, str]],
    *,
    data_ok: bool,
) -> str:
    if not data_ok:
        raise DataGapError(
            "دوره‌ی ارجاع‌شده برای سکوهای ارجاع‌شده گپ داده دارد — "
            "پست تولید/صف نمی‌شود (تصمیم ۱۶)"
        )
    _reject_digits(template, where="بدنه")
    rendered = render_draft(template, slots)
    for slug, body_md in existing_posts:
        score = similarity(rendered, body_md)
        if score >= SIMILARITY_THRESHOLD:
            raise NearDuplicateError(
                f"شباهت {score:.2f} با پست موجود {slug!r} از آستانه‌ی "
                f"{SIMILARITY_THRESHOLD} گذشت — پیش‌نویس رد شد"
            )
    return rendered


def gate_draft(
    *,
    title_template: str,
    body_template: str,
    slots: Mapping[str, str],
    existing_posts: Iterable[tuple[str, str]],
    data_ok: bool,
) -> tuple[str, str]:
    _reject_digits(title_template, where="عنوان")
    body_md = validate_draft(body_template, slots, existing_posts, data_ok=data_ok)
    title_fa = render_draft(title_template, slots)
    return title_fa, body_md


async def has_data_gap(
    store: RetentionStore,
    *,
    platform_slugs: Iterable[str],
    instrument: str,
    since: datetime,
    until: datetime,
) -> bool:
    first_hour = hour_floor(since)
    last_hour = hour_floor(until)
    expected_hours = []
    hour = first_hour
    while hour < last_hour:
        expected_hours.append(hour)
        hour += timedelta(hours=1)
    if not expected_hours:
        return False
    for slug in platform_slugs:
        rollups = await store.get_hourly_rollups(
            SourceKind.PLATFORM, slug, instrument, since=first_hour, until=last_hour
        )
        covered = {rollup.hour_start for rollup in rollups}
        if any(hour not in covered for hour in expected_hours):
            return True
    return False
