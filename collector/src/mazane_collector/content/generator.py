"""مولد محتوای لپ‌تاپ — `mazane-generate` (بلیت ۱۴؛ بند ۱۳، تصمیم‌های ۶، ۷، ۱۶، ۱۷).

روی ماشین محلی صاحب کسب‌وکار اجرا می‌شود: کلید جمینای **هرگز از لپ‌تاپ خارج
نمی‌شود** — نه در لاگ، نه در پایگاه، نه در URL (در هدر درخواست می‌رود تا در
پیام خطا/آدرس هم نشت نکند). مولد صف پیش‌نویس سرور را پر می‌کند و سرور با
آهنگ ثابت خالی می‌کند (publisher — «لپ‌تاپ شاید خاموش باشد»).

خط لوله‌ی هر موضوع (تصمیم ۷: ۱۰۰٪ داده‌محور، مقطعی):

    کوئری داده ⟸ نقشه‌ی جای‌خالی ⟸ نثر LLM (جای‌خالی‌ها دست‌نخورده،
    دستور صریح «هیچ رقمی ننویس») ⟸ توضیح متا با مدل سبک ⟸ دروازه‌ی
    اعتبارسنجی ⟸ صف (مسیر گیت‌شده‌ی `enqueue_draft` — میان‌بر ندارد)

مدل‌ها (تصمیم ۱۷): نثر با `gemini-3.6-flash`، کار مکانیکی (توضیح متا) با
`gemini-3.5-flash-lite`. توضیح متا هم از همان دروازه می‌گذرد: چون جدول
posts ستون متا ندارد، به‌صورت بند نخستِ (لید) بدنه ذخیره می‌شود و همراه
بدنه گیت می‌شود — لایه‌ی وب توضیح متا را از همان بند اول می‌سازد.

هر ادعا با کوئری ساخته می‌شود نه با ادعای مدل (تصمیم ۱۶): پرامپت فقط
واقعیت‌های ازپیش‌ساخته (با جای‌خالی، بدون رقم) را می‌دهد و مدل حق ادعای
تازه ندارد. برای دوره‌ای که سکوی ارجاع‌شده گپ داده دارد اصلاً تولید
نمی‌شود — LLM حتی صدا زده نمی‌شود (`has_data_gap` روی rollup های ساعتی).

موضوع‌های لانچ (تصمیم ۴/۷ + بلیت ۱۵): مقایسه‌ی کارمزد، حداقل سفارش،
هزینه‌ی رفت‌وبرگشت، هزینه‌ی تحویل فیزیکی، «الان کجا باز است».
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import NamedTuple, Protocol

import httpx

from ..models import Instrument, Platform, PlatformSnapshot
from ..retention import RetentionStore
from ..slugs import SlugError
from ..store import Store
from .gate import DraftRejected, has_data_gap
from .gateway import ContentGateway
from .queue import enqueue_draft

log = logging.getLogger("mazane.collector.content")

#: مدل نثر فارسی (بند ۱۳، تصمیم ۱۷) — کیفیت نثر فاکتور انتخاب است، نه هزینه.
PROSE_MODEL = "gemini-3.6-flash"
#: مدل کارهای مکانیکی (توضیح متا، واریانت عنوان، پیش‌غربال) — تصمیم ۱۷.
# ⚠️ تصمیم ۱۷ مدل ۲.۵ لایت را می‌گفت؛ آن مدل برای کلیدهای تازه بسته شده
# (۴۰۴ — «no longer available to new users»، سنجیده‌شده ۲۰۲۶-۰۸-۰۶).
# جایگزین هم‌رده و در دسترس: ۳.۵ لایت.
MECHANICAL_MODEL = "gemini-3.5-flash-lite"

#: پنجره‌ی چک گپ داده‌ی پست مقطعی: شبانه‌روزِ منتهی به اکنون (تصمیم ۱۶).
GAP_LOOKBACK = timedelta(hours=24)
#: سری مبنای چک گپ نسخه‌ی ۱ — پست‌های لانچ همه حول طلای ۱۸ عیارند.
GAP_INSTRUMENT = Instrument.GOLD_18K.value

#: دستور سخت پرامپت — تستِ مرزی وجودش را در هر پرامپت نثر/متا چک می‌کند.
NO_DIGITS_INSTRUCTION = (
    "هیچ رقمی ننویس — نه فارسی (۰-۹) نه لاتین (0-9) نه هیچ رقم دیگری؛ "
    "هر عدد فقط از راه همین جای‌خالی‌ها بیاید و هر جای‌خالی را عیناً و "
    "دست‌نخورده به همان شکل {{name}} در متن بگذار."
)

_TIMEOUT_SECONDS = 60
_GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)


class LlmClient(Protocol):
    """سطح تماس تزریقی مدل زبانی — جمینای واقعی یا فیک قطعی تست/`--fake`."""

    async def generate(self, prompt: str, *, model: str) -> str:
        """یک پرامپت ⟸ متن خروجی مدل. مدل از ثابت‌های این ماژول می‌آید."""
        ...


class GeminiClient:
    """REST خام جمینای با httpx — عمداً بدون SDK سنگین google-generativeai.

    کلید فقط در هدر `x-goog-api-key` می‌رود (نه در URL ⟸ در استثناها و
    لاگ‌های httpx که آدرس را چاپ می‌کنند هم ظاهر نمی‌شود) و این کلاس هیچ
    مسیر لاگ/ذخیره‌ای برای آن ندارد — `repr` هم نقاب می‌زند.
    """

    def __init__(self, api_key: str, *, http: httpx.AsyncClient | None = None) -> None:
        """`http` تزریقی برای بازاستفاده‌ی اتصال؛ None ⟸ کلاینت موقت هر تماس."""
        self._api_key = api_key
        self._http = http

    def __repr__(self) -> str:  # کلید هرگز — حتی در repr و پیام خطا.
        return "GeminiClient(api_key=****)"

    async def generate(self, prompt: str, *, model: str) -> str:
        url = _GEMINI_ENDPOINT.format(model=model)
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        headers = {"x-goog-api-key": self._api_key}
        if self._http is not None:
            response = await self._http.post(url, json=payload, headers=headers)
        else:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(str(part.get("text", "")) for part in parts)
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("پاسخ جمینای شکل موردانتظار candidates/content/parts را ندارد") from exc
        if not text.strip():
            raise RuntimeError("پاسخ جمینای متن خالی است")
        return text


class FakeLlmClient:
    """فیک قطعی `LlmClient` — برای تست‌ها و اجرای آفلاین `mazane-generate --fake`.

    بدون شبکه و بدون کلید، نثری ساختگی می‌سازد که (الف) هیچ رقمی ندارد و
    (ب) همه‌ی جای‌خالی‌های پرامپت را عیناً نگه می‌دارد — یعنی رفتار همان
    مدلی که دستور پرامپت را کامل اجرا کرده. با `scripted` می‌شود پاسخ‌های
    ازپیش‌نوشته تزریق کرد (مثلاً پاسخ رقم‌دار، برای دیدن رد شدن در دروازه).
    پرامپت‌ها در `prompts` ضبط می‌شوند تا تست مرزی دستور «هیچ رقمی ننویس»
    را راستی‌آزمایی کند.
    """

    def __init__(self, scripted: Sequence[str] | None = None) -> None:
        self.prompts: list[tuple[str, str]] = []  # زوج‌های (model, prompt)
        self._scripted: list[str] = list(scripted) if scripted is not None else []

    @staticmethod
    def _topic_of(prompt: str) -> str:
        """موضوع را از خط اول پرامپت درمی‌آورد — برای نثر ساختگیِ موضوع‌محور.

        نثر فیک باید بین موضوع‌ها متمایز باشد وگرنه دروازه‌ی شباهت (که در
        تست‌ها واقعی است) پست‌های موضوع‌های مختلف را «تکراری» می‌گیرد.
        """
        for line in prompt.splitlines():
            start = line.find("درباره‌ی ")
            if start == -1:
                continue
            rest = line[start + len("درباره‌ی ") :]
            for stop in (" بنویس", " یک توضیح"):
                cut = rest.find(stop)
                if cut != -1:
                    rest = rest[:cut]
                    break
            return rest.strip()
        return "داده‌های ثبت‌شده"

    async def generate(self, prompt: str, *, model: str) -> str:
        self.prompts.append((model, prompt))
        if self._scripted:
            return self._scripted.pop(0)
        topic = self._topic_of(prompt)
        if "توضیح متا" in prompt:
            return f"نگاه فشرده به {topic}."
        facts = [line[2:] for line in prompt.splitlines() if line.startswith("- ")]
        paragraphs = [f"نگاهی به {topic}.", *facts, f"جمع‌بندی درباره‌ی {topic}."]
        return "\n\n".join(paragraphs)


class InsufficientDataError(LookupError):
    """داده‌ی کافی برای این موضوع نیست — موضوع بی‌سروصدا (با لاگ) رد می‌شود.

    خویشاوند «کهنگی، نه خطا»: نبودِ داده پست جعلی نمی‌سازد، پست نمی‌سازد.
    """


class DraftSpec(NamedTuple):
    """خروجی کوئری داده‌ی یک موضوع — هرچه دروازه و صف لازم دارند.

    `facts` همان ادعاهای کوئری‌ساخته‌اند (با جای‌خالی، بدون رقم) — ورودی
    مشترک پرامپت نثر و پرامپت متا؛ مدل حق ادعای بیرون از این‌ها را ندارد.
    """

    slug: str
    title_template: str
    prompt: str
    slots: dict[str, str]
    referenced_platforms: tuple[str, ...]
    facts: tuple[str, ...]


# ------------------------------------------------------- قالب‌بندی فارسی اعداد

_FA_DIGITS = str.maketrans("0123456789.", "۰۱۲۳۴۵۶۷۸۹٫")


def fa_int(value: int) -> str:
    """عدد صحیح با ارقام فارسی و جداکننده‌ی هزارگان (٬) — مقدار جای‌خالی."""
    return f"{value:,}".replace(",", "٬").translate(_FA_DIGITS)


def fa_decimal(value: Decimal) -> str:
    """اعشاری با ارقام فارسی و ممیز ٫ — صفرهای انتهایی حذف می‌شوند."""
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text.translate(_FA_DIGITS)


def _fa_date(moment: datetime) -> str:
    return f"{moment:%Y/%m/%d}".translate(_FA_DIGITS)


# ------------------------------------------------------------ ساخت پرامپت‌ها


def _prose_prompt(topic: str, slots: Mapping[str, str], facts: Sequence[str]) -> str:
    """پرامپت نثر: فقط واقعیت‌های ازپیش‌ساخته (ادعا با کوئری، نه با مدل)."""
    placeholders = "، ".join(f"{{{{{name}}}}}" for name in slots)
    facts_text = "\n".join(f"- {fact}" for fact in facts)
    return (
        f"یک پست کوتاه بلاگ به فارسی روان و راست‌به‌چپ درباره‌ی {topic} بنویس.\n"
        f"{NO_DIGITS_INSTRUCTION}\n"
        f"جای‌خالی‌های مجاز: {placeholders}\n"
        "فقط از واقعیت‌های زیر استفاده کن و هیچ ادعای تازه‌ای نساز؛ "
        "هر واقعیت را می‌توانی بازنویسی کنی ولی معنایش را عوض نکن:\n"
        f"{facts_text}\n"
        "خروجی فقط مارک‌داون بدنه‌ی پست باشد، بدون عنوان."
    )


def _meta_prompt(topic: str, slots: Mapping[str, str], facts: Sequence[str]) -> str:
    """پرامپت مدل سبک: توضیح متا/لید یک‌بندی — همان قیدهای سخت نثر."""
    placeholders = "، ".join(f"{{{{{name}}}}}" for name in slots)
    facts_text = "\n".join(f"- {fact}" for fact in facts)
    return (
        f"برای پستی درباره‌ی {topic} یک توضیح متای یک‌جمله‌ای کوتاه به فارسی بنویس "
        "(حدود صد و پنجاه نویسه).\n"
        f"{NO_DIGITS_INSTRUCTION}\n"
        f"جای‌خالی‌های مجاز: {placeholders}\n"
        "فقط بر پایه‌ی این واقعیت‌ها:\n"
        f"{facts_text}\n"
        "خروجی فقط همان یک جمله باشد."
    )


# ------------------------------------------------- کوئری‌های داده‌ی پنج موضوع


def fee_comparison_spec(
    platforms: Sequence[Platform],
    snapshots: Mapping[str, PlatformSnapshot],
    now: datetime,
) -> DraftSpec:
    """مقایسه‌ی کارمزد خرید/فروش — از `terms` اسنپ‌شات جاری هر سکو."""
    rows: list[tuple[Platform, Decimal, Decimal]] = []
    for platform in platforms:
        snapshot = snapshots.get(platform.slug)
        if snapshot is None:
            continue
        buy_fee = snapshot.terms.buy_fee_percent
        sell_fee = snapshot.terms.sell_fee_percent
        if buy_fee is None or sell_fee is None:
            continue
        rows.append((platform, buy_fee, sell_fee))
    if len(rows) < 2:
        raise InsufficientDataError("کارمزد معلوم برای کمتر از دو سکو — مقایسه بی‌معناست")

    slots: dict[str, str] = {"tarikh": _fa_date(now)}
    facts: list[str] = ["تاریخ این سنجش {{tarikh}} است."]
    for platform, buy_fee, sell_fee in rows:
        slots[f"karmozd_kharid_{platform.slug}"] = f"{fa_decimal(buy_fee)} درصد"
        slots[f"karmozd_forush_{platform.slug}"] = f"{fa_decimal(sell_fee)} درصد"
        facts.append(
            f"کارمزد خرید {platform.name_fa} {{{{karmozd_kharid_{platform.slug}}}}} و "
            f"کارمزد فروش آن {{{{karmozd_forush_{platform.slug}}}}} است."
        )
    cheapest = min(rows, key=lambda row: row[1])
    slots["arzantarin_kharid"] = cheapest[0].name_fa
    facts.append("کمترین کارمزد خرید در این سنجش مال {{arzantarin_kharid}} است.")
    return DraftSpec(
        slug=f"moqayese-karmozd-sakoha-{now:%Y%m%d}",
        title_template="مقایسه‌ی کارمزد خرید و فروش طلا در سکوها — {{tarikh}}",
        prompt=_prose_prompt("مقایسه‌ی کارمزد خرید و فروش طلای آب‌شده در سکوهای ایرانی", slots, facts),
        slots=slots,
        referenced_platforms=tuple(platform.slug for platform, _, _ in rows),
        facts=tuple(facts),
    )


def minimum_order_spec(
    platforms: Sequence[Platform],
    snapshots: Mapping[str, PlatformSnapshot],
    now: datetime,
) -> DraftSpec:
    """حداقل سفارش — فقط سکوهایی که خود منبع حداقل را منتشر می‌کند
    (`terms.min_order_toman`؛ نامستند جعل نمی‌شود — سرِ فیلد در models)."""
    rows: list[tuple[Platform, int]] = []
    for platform in platforms:
        snapshot = snapshots.get(platform.slug)
        if snapshot is None or snapshot.terms.min_order_toman is None:
            continue
        rows.append((platform, snapshot.terms.min_order_toman))
    if len(rows) < 2:
        raise InsufficientDataError("حداقل سفارش مستند برای کمتر از دو سکو")

    slots: dict[str, str] = {"tarikh": _fa_date(now)}
    facts: list[str] = ["این اعداد در {{tarikh}} از خود سکوها خوانده شده‌اند."]
    for platform, min_order in rows:
        slots[f"hadeaghal_{platform.slug}"] = f"{fa_int(min_order)} تومان"
        facts.append(
            f"برای شروع در {platform.name_fa} دست‌کم {{{{hadeaghal_{platform.slug}}}}} لازم است."
        )
    lowest = min(rows, key=lambda row: row[1])
    slots["payintarin_sad"] = lowest[0].name_fa
    facts.append("پایین‌ترین سد ورود در این سنجش مال {{payintarin_sad}} است.")
    return DraftSpec(
        slug=f"hadeaghal-sefaresh-sakoha-{now:%Y%m%d}",
        title_template="با چند تومان می‌شود شروع کرد؟ حداقل سفارش سکوها — {{tarikh}}",
        prompt=_prose_prompt("حداقل ارزش سفارش خرید طلا در سکوهای ایرانی", slots, facts),
        slots=slots,
        referenced_platforms=tuple(platform.slug for platform, _ in rows),
        facts=tuple(facts),
    )


def round_trip_spec(
    platforms: Sequence[Platform],
    snapshots: Mapping[str, PlatformSnapshot],
    now: datetime,
) -> DraftSpec:
    """هزینه‌ی رفت‌وبرگشت — `terms.round_trip_percent` (فرمول فقط در گردآورنده)."""
    rows: list[tuple[Platform, Decimal]] = []
    for platform in platforms:
        snapshot = snapshots.get(platform.slug)
        if snapshot is None or snapshot.terms.round_trip_percent is None:
            continue
        rows.append((platform, snapshot.terms.round_trip_percent))
    if len(rows) < 2:
        raise InsufficientDataError("هزینه‌ی رفت‌وبرگشت معلوم برای کمتر از دو سکو")

    slots: dict[str, str] = {"tarikh": _fa_date(now)}
    facts: list[str] = ["محاسبه‌های این پست مال {{tarikh}} اند."]
    for platform, round_trip in rows:
        slots[f"raftobargasht_{platform.slug}"] = f"{fa_decimal(round_trip)} درصد"
        facts.append(
            f"اگر همین حالا در {platform.name_fa} بخرید و بی‌درنگ بفروشید، "
            f"{{{{raftobargasht_{platform.slug}}}}} از پولتان آب می‌رود."
        )
    cheapest = min(rows, key=lambda row: row[1])
    most_expensive = max(rows, key=lambda row: row[1])
    slots["kamhazinetarin"] = cheapest[0].name_fa
    slots["porhazinetarin"] = most_expensive[0].name_fa
    facts.append("کمترین آب‌رفتگی رفت‌وبرگشت مال {{kamhazinetarin}} است.")
    facts.append("بیشترین آب‌رفتگی مال {{porhazinetarin}} است.")
    return DraftSpec(
        slug=f"hazine-raft-o-bargasht-sakoha-{now:%Y%m%d}",
        title_template="هزینه‌ی رفت‌وبرگشت طلا در سکوها — {{tarikh}}",
        prompt=_prose_prompt(
            "هزینه‌ی واقعی یک رفت‌وبرگشت کامل (خرید و فروش) طلا در سکوهای ایرانی",
            slots,
            facts,
        ),
        slots=slots,
        referenced_platforms=tuple(platform.slug for platform, _ in rows),
        facts=tuple(facts),
    )


def physical_delivery_spec(
    platforms: Sequence[Platform],
    snapshots: Mapping[str, PlatformSnapshot],
    now: datetime,
) -> DraftSpec:
    """هزینه‌ی تحویل فیزیکی — از `delivery_note_fa` سکوها (فراداده‌ی مستند
    سند تحقیق ۰۱؛ رقم داخل یادداشت از داده می‌آید، نه از مدل)."""
    noted = [platform for platform in platforms if platform.delivery_note_fa is not None]
    if not noted:
        raise InsufficientDataError("هیچ سکویی شرایط تحویل فیزیکی مستند ندارد")
    silent = [platform for platform in platforms if platform.delivery_note_fa is None]

    slots: dict[str, str] = {"tarikh": _fa_date(now)}
    facts: list[str] = ["وضعیت تحویل در {{tarikh}} ثبت شده است."]
    for platform in noted:
        note = platform.delivery_note_fa
        assert note is not None  # فیلترشده در بالا
        slots[f"tahvil_{platform.slug}"] = note
        facts.append(f"شرایط تحویل فیزیکی {platform.name_fa}: {{{{tahvil_{platform.slug}}}}}.")
    if silent:
        slots["sakoha_ye_bi_elam"] = "، ".join(platform.name_fa for platform in silent)
        facts.append(
            "این سکوها شرایط تحویل فیزیکی را علنی اعلام نکرده‌اند: {{sakoha_ye_bi_elam}}."
        )
    return DraftSpec(
        slug=f"hazine-tahvil-fiziki-sakoha-{now:%Y%m%d}",
        title_template="هزینه‌ی تحویل فیزیکی طلا در سکوها — {{tarikh}}",
        prompt=_prose_prompt("هزینه و شرایط تحویل فیزیکی طلا در سکوهای ایرانی", slots, facts),
        slots=slots,
        referenced_platforms=tuple(platform.slug for platform in noted),
        facts=tuple(facts),
    )


def open_now_spec(
    platforms: Sequence[Platform],
    snapshots: Mapping[str, PlatformSnapshot],
    now: datetime,
) -> DraftSpec:
    """«الان کجا باز است» — پرچم‌های `buy_enabled`/`sell_enabled` اسنپ‌شات جاری
    (مزیت رقابتی تصمیم ۱۹: وضعیت باز/بسته‌ی خرید و فروش)."""
    present = [platform for platform in platforms if platform.slug in snapshots]
    if len(present) < 2:
        raise InsufficientDataError("اسنپ‌شات جاری برای کمتر از دو سکو")

    fully_open: list[str] = []
    limited: list[str] = []
    for platform in present:
        terms = snapshots[platform.slug].terms
        if terms.buy_enabled and terms.sell_enabled:
            fully_open.append(platform.name_fa)
        else:
            limited.append(platform.name_fa)

    slots: dict[str, str] = {
        "tarikh": _fa_date(now),
        "shomar_sakoha": fa_int(len(present)),
        "shomar_baz": fa_int(len(fully_open)),
        "sakoha_ye_baz": "، ".join(fully_open) if fully_open else "هیچ‌کدام",
        "sakoha_ye_mahdud": "، ".join(limited) if limited else "هیچ‌کدام",
    }
    facts = [
        "این وضعیت در {{tarikh}} دیده شده است.",
        "از {{shomar_sakoha}} سکوی بررسی‌شده، {{shomar_baz}} سکو هر دو سمت خرید و فروش را باز دارند.",
        "سکوهای کاملاً باز: {{sakoha_ye_baz}}.",
        "سکوهای با محدودیت در خرید یا فروش: {{sakoha_ye_mahdud}}.",
    ]
    return DraftSpec(
        slug=f"alan-koja-baz-ast-{now:%Y%m%d}",
        title_template="الان کجا باز است؟ وضعیت خرید و فروش سکوها — {{tarikh}}",
        prompt=_prose_prompt(
            "اینکه همین حالا در کدام سکوهای طلای ایرانی می‌شود خرید و فروش کرد",
            slots,
            facts,
        ),
        slots=slots,
        referenced_platforms=tuple(platform.slug for platform in present),
        facts=tuple(facts),
    )


TopicBuilder = Callable[
    [Sequence[Platform], Mapping[str, PlatformSnapshot], datetime], DraftSpec
]

#: پنج موضوع لانچ (تصمیم ۷ + بلیت ۱۵) — ترتیبْ ترتیب صف شدن است.
TOPIC_BUILDERS: tuple[tuple[str, TopicBuilder], ...] = (
    ("مقایسه‌ی کارمزد", fee_comparison_spec),
    ("حداقل سفارش", minimum_order_spec),
    ("هزینه‌ی رفت‌وبرگشت", round_trip_spec),
    ("هزینه‌ی تحویل فیزیکی", physical_delivery_spec),
    ("الان کجا باز است", open_now_spec),
)


# ------------------------------------------------------------------ خط لوله


async def generate_launch_drafts(
    *,
    store: Store,
    retention: RetentionStore,
    gateway: ContentGateway,
    llm: LlmClient,
    now: datetime | None = None,
) -> tuple[str, ...]:
    """یک اجرای کامل مولد: پنج موضوع ⟸ صفِ گیت‌شده. خروجی: اسلاگ‌های صف‌شده.

    هر موضوع مستقل شکست می‌خورد (داده‌ی ناکافی، گپ، رد دروازه، برخورد
    اسلاگ) و بقیه ادامه می‌دهند — اجرای دوباره در همان روز به برخورد اسلاگ
    یا شباهت می‌خورد و همین رفتار درست است (نه پست تکراری، نه سقوط).
    """
    moment = now if now is not None else datetime.now(UTC)
    platforms = await store.get_listed_platforms()
    snapshots: dict[str, PlatformSnapshot] = {}
    for platform in platforms:
        snapshot = await store.get_snapshot(platform.slug)
        if snapshot is not None:
            snapshots[platform.slug] = snapshot

    enqueued: list[str] = []
    for label, builder in TOPIC_BUILDERS:
        try:
            spec = builder(platforms, snapshots, moment)
        except InsufficientDataError as exc:
            log.warning("موضوع «%s» تولید نشد — داده‌ی کافی نیست: %s", label, exc)
            continue
        data_ok = not await has_data_gap(
            retention,
            platform_slugs=spec.referenced_platforms,
            instrument=GAP_INSTRUMENT,
            since=moment - GAP_LOOKBACK,
            until=moment,
        )
        if not data_ok:
            # تصمیم ۱۶: دوره‌ی دارای گپ اصلاً پست نمی‌گیرد — LLM صدا نمی‌خورد.
            log.warning("موضوع «%s» تولید نشد — گپ داده در دوره‌ی ارجاع", label)
            continue
        prose = await llm.generate(spec.prompt, model=PROSE_MODEL)
        meta = await llm.generate(
            _meta_prompt(label, spec.slots, spec.facts), model=MECHANICAL_MODEL
        )
        body_template = f"*{meta.strip()}*\n\n{prose.strip()}\n"
        try:
            await enqueue_draft(
                gateway,
                slug=spec.slug,
                title_template=spec.title_template,
                body_template=body_template,
                slots=spec.slots,
                data_ok=data_ok,
                now=moment,
            )
        except (SlugError, DraftRejected) as exc:
            log.warning("پیش‌نویس «%s» (%s) پشت دروازه رد شد: %s", label, spec.slug, exc)
            continue
        enqueued.append(spec.slug)
        log.info("پیش‌نویس «%s» صف شد: %s", label, spec.slug)
    return tuple(enqueued)


# ------------------------------------------------------------------ فرمان CLI


async def _run_generate(*, fake: bool) -> tuple[str, ...]:
    import asyncpg  # فقط مسیر CLI — تست‌ها این پایین نمی‌آیند

    from ..store.postgres_store import PostgresStore
    from .gateway import PostgresContentGateway

    database_url = os.environ.get(
        "MAZANE_DATABASE_URL", "postgresql://mazane:mazane@127.0.0.1:5432/mazane"
    )
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=1)
    assert pool is not None
    try:
        store = PostgresStore(pool)  # هم Store هم RetentionStore را پیاده می‌کند
        gateway = PostgresContentGateway(pool)
        if fake:
            return await generate_launch_drafts(
                store=store, retention=store, gateway=gateway, llm=FakeLlmClient()
            )
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as http:
            llm = GeminiClient(os.environ["GEMINI_API_KEY"], http=http)
            return await generate_launch_drafts(
                store=store, retention=store, gateway=gateway, llm=llm
            )
    finally:
        await pool.close()


def main() -> None:
    """نقطه‌ی ورود `mazane-generate [--fake]` — زمان‌بندی‌شده روی لپ‌تاپ.

    بدون `GEMINI_API_KEY` با پیام روشن فارسی می‌ایستد (بدون traceback) —
    کلید فقط روی همین ماشین است و هرگز جایی نمی‌رود (تصمیم ۱۷). `--fake`
    برای تمرین آفلاین خط لوله بدون کلید و شبکه است (LLM ساختگی).
    """
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    args = sys.argv[1:]
    fake = "--fake" in args
    rest = [arg for arg in args if arg != "--fake"]
    if rest:
        print("کاربرد: mazane-generate [--fake]", file=sys.stderr)
        raise SystemExit(2)
    if not fake and not os.environ.get("GEMINI_API_KEY"):
        print(
            "کلید GEMINI_API_KEY تنظیم نیست — مولد فقط روی لپ‌تاپ صاحب کسب‌وکار "
            "با کلید محلی اجرا می‌شود و کلید هرگز از این ماشین خارج نمی‌شود "
            "(تصمیم ۱۷). برای تمرین آفلاین بدون کلید: mazane-generate --fake",
            file=sys.stderr,
        )
        raise SystemExit(2)
    enqueued = asyncio.run(_run_generate(fake=fake))
    if enqueued:
        print("صف شد: " + "، ".join(enqueued))
    else:
        print("چیزی صف نشد — لاگ بالا دلیل هر موضوع را می‌گوید", file=sys.stderr)
