"""دروازه‌ی اعتبارسنجی محتوا — توابع خالص سمت سرور (بند ۱۳، تصمیم ۱۶؛ بلیت ۱۴).

مدل قالب/جای‌خالی: پیش‌نویس = متن قالب با جای‌خالی‌های `{{name}}` + نقشه‌ی
جای‌خالی‌ها که **فقط از کوئری داده** پر می‌شود، هرگز از مدل زبانی. مدل فقط
نثر می‌نویسد و جای‌خالی‌ها را دست‌نخورده می‌گذارد؛ سرور پیش از صف شدن
جای‌خالی‌ها را از پایگاه پر می‌کند. قواعد رد (همه سخت — رد یعنی استثنا):

۱) **هیچ رقمی از مدل پذیرفته نمی‌شود.** هر رقم بیرون از جای‌خالی در قالب —
   فارسی (۰-۹)، لاتین (0-9) و هر رقم اعشاری یونیکد دیگر مثل عربی (٠-٩) —
   کل پیش‌نویس را رد می‌کند. رقمِ داخل مقدارِ جای‌خالی مجاز است: از پایگاه
   آمده، نه از مدل.
۲) **جای‌خالی پرنشده یا بدقواره ⟸ رد.** قالب جای‌خالیِ بی‌مقدار نداشته
   باشد و بعد از پر شدن هیچ `{{` یا `}}` در متن نماند (جای‌خالیِ بدقواره
   مثل `{{Fee}}` بی‌صدا رد نمی‌شود، استثنا می‌گیرد).
۳) **گپ داده ⟸ رد.** فراخوان‌دهنده نتیجه‌ی چک گپ را با `data_ok` می‌دهد؛
   کمکی `has_data_gap` روی rollup های ساعتی (retention، بلیت ۱۶) همین چک
   را حساب می‌کند: هر ساعتِ کاملِ دوره برای هر سکوی ارجاع‌شده باید ردیف
   تجمیع داشته باشد.
۴) **شباهت متنی بالای آستانه با پست‌های موجود ⟸ رد.** سنجه‌ی قطعی و
   بدون LLM: ژاکار ۳-گرم نویسه‌ای روی متن نرمال‌شده (بی‌علامت، casefold،
   فاصله‌ی فشرده). آستانه: `SIMILARITY_THRESHOLD` — دو بازنویسیِ همان
   مطلب با همان اعداد بالای آن می‌افتند، دو موضوع متفاوت زیر آن.
   «پست موجود» یعنی هر ردیف جدول posts در هر وضعیتی: پیش‌نویسِ در صف هم
   می‌شمارد (مولد نباید یک مطلب را دوبار صف کند) و پس‌گرفته هم (مطلبی که
   پس گرفته شد نباید با تغییر جزئی برگردد).

اینجا هیچ I/O ای نیست جز `has_data_gap` که روی اینترفیس تزریقی
`RetentionStore` می‌چرخد — تست مرز گردآورنده با فیک درون‌حافظه‌ای سبز
می‌شود (الگوی retention).
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from datetime import datetime, timedelta

from ..retention import RetentionStore, SourceKind, hour_floor

#: آستانه‌ی رد شباهت — ژاکار ۳-گرم نویسه‌ای `similarity` روی متن نرمال‌شده.
#: نمره‌ی >= آستانه رد می‌شود. ۰٫۵ یعنی نیمی از ۳-گرم‌های دو متن مشترک‌اند —
#: بازنویسی همان مطلب همیشه بالاتر است، موضوع مستقل به‌وضوح پایین‌تر.
SIMILARITY_THRESHOLD = 0.5

#: قالب جای‌خالی: `{{name}}` با نام لاتین کوچک — بدون فاصله، عمداً سخت‌گیر
#: (هر شکل دیگری «بدقواره» است و پس از رندر با چک `{{`/`}}` رد می‌شود).
SLOT_PATTERN = re.compile(r"\{\{([a-z][a-z0-9_]*)\}\}")

# ‏\d در پایتون همه‌ی ارقام اعشاری یونیکد (Nd) را می‌گیرد: ۰-۹ فارسی،
# 0-9 لاتین، ٠-٩ عربی و باقی — سخت‌گیرترین خوانش تصمیم ۱۶.
_ANY_DIGIT = re.compile(r"\d")

# نرمال‌سازی شباهت: هر چیز غیر «واژه» (علائم، فاصله، نیم‌فاصله‌ی U+200C که
# جزو \w نیست) به یک فاصله فشرده می‌شود تا سنجه به علامت‌گذاری حساس نباشد.
_NON_WORD = re.compile(r"\W+")


class DraftRejected(ValueError):
    """پایه‌ی خطاهای دروازه — رد یعنی استثنا؛ چیزی صف نمی‌شود."""


class DigitOutsideSlotError(DraftRejected):
    """رقم بیرون از جای‌خالی در قالب — هیچ رقمی از مدل پذیرفته نمی‌شود."""


class UnfilledSlotError(DraftRejected):
    """جای‌خالیِ بی‌مقدار، یا جای‌خالی بدقواره‌ای که پس از رندر باقی ماند."""


class DataGapError(DraftRejected):
    """دوره‌ی ارجاع‌شده برای سکوهای ارجاع‌شده گپ داده دارد."""


class NearDuplicateError(DraftRejected):
    """شباهت متنی با یک پست موجود از آستانه گذشت."""


def render_draft(template: str, slots: Mapping[str, str]) -> str:
    """پر کردن جای‌خالی‌های `{{name}}` از نقشه — یک گذر، بدون بازگشت.

    جای‌خالیِ بی‌مقدار ⟸ `UnfilledSlotError`. یک‌گذری بودن عمدی است: اگر
    مقدارِ جای‌خالی خودش `{{` داشته باشد دوباره رندر نمی‌شود و چک پایانی
    ردش می‌کند — مقدار جای‌خالی داده است، نه قالب.
    """

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
    """رد قالبِ رقم‌دار — رقم فقط داخل جای‌خالی (یعنی از پایگاه) مجاز است."""
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
    """ژاکار ۳-گرم نویسه‌ای روی متن نرمال‌شده — قطعی، بدون LLM (تصمیم ۱۶).

    متنِ کوتاه‌تر از یک ۳-گرم فقط با برابریِ نرمال‌شده «مشابه» است.
    """
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
    """اجرای هر چهار قاعده‌ی دروازه روی یک قالب؛ خروجی = متن رندرشده.

    `existing_posts` زوج‌های `(slug, body_md)` جدول posts اند (هر وضعیتی —
    سرِ ماژول). `data_ok` نتیجه‌ی چک گپ فراخوان‌دهنده است (`has_data_gap`).
    رد یعنی استثنای خانواده‌ی `DraftRejected` — چیزی برنمی‌گردد که جایی
    صف شود.
    """
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
    """دروازه‌ی کامل یک پیش‌نویس: عنوان + بدنه، با یک نقشه‌ی جای‌خالی مشترک.

    عنوان هم قالب است (رقم بیرون از جای‌خالی ⟸ رد؛ جای‌خالی باید پر شود)
    ولی چک شباهت فقط روی بدنه است — عنوانِ کوتاه ۳-گرمِ معناداری ندارد و
    برخورد عنوان را قید یکتایی اسلاگ می‌گیرد. خروجی: `(title_fa, body_md)`
    رندرشده، آماده‌ی درج.
    """
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
    """چک گپ داده‌ی دوره (تصمیم ۱۶) روی rollup های ساعتی بلیت ۱۶.

    هر ساعتِ کاملِ دوره‌ی `[since, until)` برای **هر** سکوی ارجاع‌شده باید
    ردیف تجمیع داشته باشد (هر سمتی)؛ یک ساعتِ غایب یعنی گپ ⟸ True و پستی
    برای این دوره تولید نمی‌شود. دوره‌ی بدون هیچ ساعت کامل چیزی برای چک
    ندارد ⟸ False (فراخوان‌دهنده باید دست‌کم یک ساعت کامل بدهد — مولد
    پنجره‌ی ۲۴ ساعته می‌دهد).
    """
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
