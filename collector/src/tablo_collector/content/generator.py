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

PROSE_MODEL = "gemini-3.6-flash"
MECHANICAL_MODEL = "gemini-3.5-flash-lite"

GAP_LOOKBACK = timedelta(hours=24)
GAP_INSTRUMENT = Instrument.GOLD_18K.value

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
    async def generate(self, prompt: str, *, model: str) -> str:
        ...


class GeminiClient:
    def __init__(self, api_key: str, *, http: httpx.AsyncClient | None = None) -> None:
        self._api_key = api_key
        self._http = http

    def __repr__(self) -> str:
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
            raise RuntimeError("Gemini response does not have the expected candidates/content/parts shape") from exc
        if not text.strip():
            raise RuntimeError("Gemini response text is empty")
        return text


class FakeLlmClient:
    def __init__(self, scripted: Sequence[str] | None = None) -> None:
        self.prompts: list[tuple[str, str]] = []
        self._scripted: list[str] = list(scripted) if scripted is not None else []

    @staticmethod
    def _topic_of(prompt: str) -> str:
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
    pass


class DraftSpec(NamedTuple):
    slug: str
    title_template: str
    prompt: str
    slots: dict[str, str]
    referenced_platforms: tuple[str, ...]
    facts: tuple[str, ...]


_FA_DIGITS = str.maketrans("0123456789.", "۰۱۲۳۴۵۶۷۸۹٫")


def fa_int(value: int) -> str:
    return f"{value:,}".replace(",", "٬").translate(_FA_DIGITS)


def fa_decimal(value: Decimal) -> str:
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text.translate(_FA_DIGITS)


def _fa_date(moment: datetime) -> str:
    return f"{moment:%Y/%m/%d}".translate(_FA_DIGITS)


def _prose_prompt(topic: str, slots: Mapping[str, str], facts: Sequence[str]) -> str:
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


def fee_comparison_spec(
    platforms: Sequence[Platform],
    snapshots: Mapping[str, PlatformSnapshot],
    now: datetime,
) -> DraftSpec:
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
        raise InsufficientDataError("fee known for fewer than two platforms — comparison would be meaningless")

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
    rows: list[tuple[Platform, int]] = []
    for platform in platforms:
        snapshot = snapshots.get(platform.slug)
        if snapshot is None or snapshot.terms.min_order_toman is None:
            continue
        rows.append((platform, snapshot.terms.min_order_toman))
    if len(rows) < 2:
        raise InsufficientDataError("minimum order documented for fewer than two platforms")

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
    rows: list[tuple[Platform, Decimal]] = []
    for platform in platforms:
        snapshot = snapshots.get(platform.slug)
        if snapshot is None or snapshot.terms.round_trip_percent is None:
            continue
        rows.append((platform, snapshot.terms.round_trip_percent))
    if len(rows) < 2:
        raise InsufficientDataError("round-trip cost known for fewer than two platforms")

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
    noted = [platform for platform in platforms if platform.delivery_note_fa is not None]
    if not noted:
        raise InsufficientDataError("no platform has documented physical delivery terms")
    silent = [platform for platform in platforms if platform.delivery_note_fa is None]

    slots: dict[str, str] = {"tarikh": _fa_date(now)}
    facts: list[str] = ["وضعیت تحویل در {{tarikh}} ثبت شده است."]
    for platform in noted:
        note = platform.delivery_note_fa
        assert note is not None
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
    present = [platform for platform in platforms if platform.slug in snapshots]
    if len(present) < 2:
        raise InsufficientDataError("current snapshot for fewer than two platforms")

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

TOPIC_BUILDERS: tuple[tuple[str, TopicBuilder], ...] = (
    ("مقایسه‌ی کارمزد", fee_comparison_spec),
    ("حداقل سفارش", minimum_order_spec),
    ("هزینه‌ی رفت‌وبرگشت", round_trip_spec),
    ("هزینه‌ی تحویل فیزیکی", physical_delivery_spec),
    ("الان کجا باز است", open_now_spec),
)


async def generate_launch_drafts(
    *,
    store: Store,
    retention: RetentionStore,
    gateway: ContentGateway,
    llm: LlmClient,
    now: datetime | None = None,
) -> tuple[str, ...]:
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
            log.warning("topic «%s» not generated — insufficient data: %s", label, exc)
            continue
        data_ok = not await has_data_gap(
            retention,
            platform_slugs=spec.referenced_platforms,
            instrument=GAP_INSTRUMENT,
            since=moment - GAP_LOOKBACK,
            until=moment,
        )
        if not data_ok:
            log.warning("topic «%s» not generated — data gap in referenced period", label)
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
            log.warning("draft «%s» (%s) rejected at the gate: %s", label, spec.slug, exc)
            continue
        enqueued.append(spec.slug)
        log.info("draft «%s» queued: %s", label, spec.slug)
    return tuple(enqueued)


async def _run_generate(*, fake: bool) -> tuple[str, ...]:
    import asyncpg

    from ..store.postgres_store import PostgresStore
    from .gateway import PostgresContentGateway

    database_url = os.environ.get(
        "TABLO_DATABASE_URL", "postgresql://mazane:mazane@127.0.0.1:5432/mazane"
    )
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=1)
    assert pool is not None
    try:
        store = PostgresStore(pool)
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
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    args = sys.argv[1:]
    fake = "--fake" in args
    rest = [arg for arg in args if arg != "--fake"]
    if rest:
        print("usage: tablo-generate [--fake]", file=sys.stderr)
        raise SystemExit(2)
    if not fake and not os.environ.get("GEMINI_API_KEY"):
        print(
            "GEMINI_API_KEY is not set — the generator only runs on the owner's laptop "
            "with a local key, and the key never leaves that machine. "
            "For offline practice without a key: tablo-generate --fake",
            file=sys.stderr,
        )
        raise SystemExit(2)
    enqueued = asyncio.run(_run_generate(fake=fake))
    if enqueued:
        print("queued: " + ", ".join(enqueued))
    else:
        print("nothing queued — the log above explains each topic", file=sys.stderr)
