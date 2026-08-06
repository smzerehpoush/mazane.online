"""مرز گردآورنده‌ی مراجع قیمت: فیکسچر ⟸ ردیف‌های مرجع در استور (بند ۱۲.۲).

فیکسچرهای واقعی ضبط‌شده‌ی ۲۰۲۶-۰۸-۰۶ (بدون هیچ تماس شبکه‌ای در تست):

- `talair_price.json`  — پاسخ `GET www.tala.ir/ajax/price/talair`؛ همین
  payload زنده فیلد خراب هم دارد (`gold_mesghal_usd.v = "0"`، بازار بسته).
- `bonbast_page.html`  — صفحه‌ی کامل `bonbast.com` با توکن گردان `/json`.
- `bonbast_json.json`  — پاسخ `POST bonbast.com/json` با همان توکن.

قواعد قفل‌شده: مرجع سکو نیست (هرگز در فهرست عمومی نمی‌آید)، عددش همیشه با
ذکر منبع ذخیره می‌شود، بن‌بست **تومان** است (÷۱۰ ممنوع — خطای ۱۰۰۰٪)، و
مراجع به‌کلی بیرون از رأی چک میانه‌اند (docstring ماژول references.pipeline).
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.pipeline import AdapterError
from mazane_collector.models import Side
from mazane_collector.platforms import PLATFORMS
from mazane_collector.references import ReferenceInstrument
from mazane_collector.references.bonbast import (
    BONBAST_JSON_ENDPOINT,
    BONBAST_PAGE_ENDPOINT,
    BonbastReference,
    extract_json_param,
)
from mazane_collector.references.pipeline import REFERENCE_SOURCES, collect_reference_round
from mazane_collector.references.talair import TALAIR_ENDPOINT, TalairReference
from mazane_collector.store.memory import InMemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)

BONBAST_TOKEN = "937aade90fb253f95898eb25ace521c2,QSXVx,2026-08-06-04-46-43"


def talair_payload() -> Any:
    return json.loads((FIXTURES / "talair_price.json").read_text(encoding="utf-8"))


def bonbast_html() -> str:
    return (FIXTURES / "bonbast_page.html").read_text(encoding="utf-8")


def bonbast_json_text() -> str:
    return (FIXTURES / "bonbast_json.json").read_text(encoding="utf-8")


class FakeTransport:
    """فیک قرارداد ReferenceTransport — پاسخ‌ها از فیکسچر، با ثبت درخواست‌ها."""

    def __init__(self, get_responses: dict[str, Any], post_responses: dict[str, Any]) -> None:
        self._get = get_responses
        self._post = post_responses
        self.post_data: list[dict[str, str]] = []

    async def get_text(self, url: str, *, headers: Any = None) -> str:
        value = self._get[url]
        if isinstance(value, Exception):
            raise value
        return str(value)

    async def post_form(self, url: str, data: Any, *, headers: Any = None) -> str:
        self.post_data.append(dict(data))
        value = self._post[url]
        if isinstance(value, Exception):
            raise value
        return str(value)


def full_transport() -> FakeTransport:
    return FakeTransport(
        get_responses={
            TALAIR_ENDPOINT: json.dumps(talair_payload()),
            BONBAST_PAGE_ENDPOINT: bonbast_html(),
        },
        post_responses={BONBAST_JSON_ENDPOINT: bonbast_json_text()},
    )


# ― طلا دات‌آی‌آر ―


async def test_talair_fixture_is_stored_with_attribution_and_x1_scale() -> None:
    store = InMemoryStore()

    await collect_reference_round(
        (TalairReference(),), full_transport(), store, now=FETCHED_AT
    )

    stored = await store.get_reference("talair")
    assert stored is not None
    # ذکر منبع داخل خود داده — قید مطلق بند ۱۲.۲/۷.۱.
    assert stored.name_fa == "طلا دات‌آی‌آر"
    assert stored.source_url == "https://www.tala.ir/"
    assert stored.fetched_at == FETCHED_AT

    by_instrument = {q.instrument: q for q in stored.quotes}
    # بازار تهران آب‌شده + انس جهانی + گرم ۱۸ (رشته‌ی هزارگان‌دار ⟸ عدد).
    assert by_instrument[ReferenceInstrument.GOLD_18K_TOMAN].value == Decimal("18559700")
    assert by_instrument[ReferenceInstrument.ABSHODE_MITHQAL_TOMAN].value == Decimal(
        "80397000"
    )
    assert by_instrument[ReferenceInstrument.XAU_USD].value == Decimal("4046.35")
    for quote in stored.quotes:
        assert quote.side is Side.MID
        assert quote.raw_scale == Decimal("1")
        assert quote.value == quote.raw_value * quote.raw_scale


async def test_talair_broken_field_is_skipped_field_by_field_not_fatal() -> None:
    """tala.ir داده‌ی خراب دارد (بند ۳.۶ سند تحقیق): فیلد صفرشده فقط خودش
    کنار می‌رود؛ فیلدهای سالم همان نوبت ذخیره می‌شوند."""
    payload = talair_payload()
    payload["gold"]["gold_18k"]["v"] = "0"  # همان الگوی خرابی زنده‌ی arz_dolar
    transport = FakeTransport(
        get_responses={TALAIR_ENDPOINT: json.dumps(payload)}, post_responses={}
    )
    store = InMemoryStore()

    await collect_reference_round((TalairReference(),), transport, store, now=FETCHED_AT)

    stored = await store.get_reference("talair")
    assert stored is not None
    instruments = {q.instrument for q in stored.quotes}
    assert ReferenceInstrument.GOLD_18K_TOMAN not in instruments
    assert ReferenceInstrument.ABSHODE_MITHQAL_TOMAN in instruments
    assert ReferenceInstrument.XAU_USD in instruments


async def test_talair_all_fields_broken_means_stale_reference_not_bad_data() -> None:
    payload = talair_payload()
    for field in ("gold_18k", "gold_bazaruser", "gold_ounce"):
        payload["gold"][field]["v"] = "0"
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        TalairReference().parse(payload, FETCHED_AT)

    transport = FakeTransport(
        get_responses={TALAIR_ENDPOINT: json.dumps(payload)}, post_responses={}
    )
    saved = await collect_reference_round(
        (TalairReference(),), transport, store, now=FETCHED_AT
    )
    assert saved == ()
    assert await store.get_reference("talair") is None


# ― بن‌بست ―


def test_bonbast_token_is_extracted_from_recorded_html() -> None:
    assert extract_json_param(bonbast_html()) == BONBAST_TOKEN


def test_bonbast_html_without_token_raises() -> None:
    with pytest.raises(AdapterError):
        extract_json_param("<html><body>صفحه‌ی دگرگون‌شده</body></html>")


async def test_bonbast_two_step_fetch_stores_toman_values_with_x1_scale() -> None:
    transport = full_transport()
    store = InMemoryStore()

    await collect_reference_round((BonbastReference(),), transport, store, now=FETCHED_AT)

    # توکنِ همان صفحه به /json پست شد.
    assert transport.post_data == [{"param": BONBAST_TOKEN}]

    stored = await store.get_reference("bonbast")
    assert stored is not None
    assert stored.name_fa == "بن‌بست"
    assert stored.source_url == "https://bonbast.com/"

    by_key = {(q.instrument, q.side): q for q in stored.quotes}
    # ⚠️ بن‌بست تومان است نه ریال (بند ۳.۵ سند تحقیق): ضریب ×۱ — اگر کسی
    # ÷۱۰ اعمال کند این عدد ده برابر کوچک می‌شود و تست می‌شکند (خطای ۱۰۰۰٪).
    gold = by_key[(ReferenceInstrument.GOLD_18K_TOMAN, Side.MID)]
    assert gold.value == Decimal("18555796")
    assert gold.raw_scale == Decimal("1")
    assert by_key[(ReferenceInstrument.ABSHODE_MITHQAL_TOMAN, Side.MID)].value == Decimal(
        "80380000"
    )
    assert by_key[(ReferenceInstrument.XAU_USD, Side.MID)].value == Decimal("4258.49")
    # دلار دو سمت دارد؛ نگاشت با قاعده‌ی ثابت ask_bid (usd1 بزرگ‌تر است).
    assert by_key[(ReferenceInstrument.USD_TOMAN, Side.BUY)].value == Decimal("187400")
    assert by_key[(ReferenceInstrument.USD_TOMAN, Side.SELL)].value == Decimal("187300")


async def test_bonbast_stale_token_response_is_stale_reference_not_bad_data() -> None:
    """توکن کهنه فقط `{"rest": "1"}` می‌دهد — باید کهنگی مرجع باشد، نه ثبت
    ردیف تهی."""
    transport = FakeTransport(
        get_responses={BONBAST_PAGE_ENDPOINT: bonbast_html()},
        post_responses={BONBAST_JSON_ENDPOINT: json.dumps({"rest": "1"})},
    )
    store = InMemoryStore()

    saved = await collect_reference_round(
        (BonbastReference(),), transport, store, now=FETCHED_AT
    )

    assert saved == ()
    assert await store.get_reference("bonbast") is None


# ― قواعد سراسری مراجع ―


async def test_references_are_stored_but_never_platforms_nor_listed() -> None:
    """معیار پذیرش بلیت ۵: داده‌ی مراجع ذخیره می‌شود ولی در جدول مقایسه
    (فهرست عمومی سکوها) نمی‌آید — نه ردیف، نه لینک معرف."""
    store = InMemoryStore()
    await store.save_platforms(PLATFORMS)

    saved = await collect_reference_round(
        REFERENCE_SOURCES, full_transport(), store, now=FETCHED_AT
    )
    assert {s.reference_slug for s in saved} == {"talair", "bonbast"}

    # در استور مرجع هست…
    assert await store.get_reference("talair") is not None
    assert await store.get_reference("bonbast") is not None
    # …و در تاریخچه (آرشیو الزام حقوقی — بند ۷.۱).
    assert {s.reference_slug for s in store.reference_history} == {"talair", "bonbast"}

    # …ولی هرگز سکو نیست: نه در فهرست عمومی، نه در PLATFORMS، نه در کلید سکوها.
    listed_slugs = {p.slug for p in await store.get_listed_platforms()}
    assert listed_slugs.isdisjoint({"talair", "bonbast"})
    assert {p.slug for p in PLATFORMS}.isdisjoint({"talair", "bonbast"})
    assert await store.get_snapshot("talair") is None
    assert await store.get_snapshot("bonbast") is None


async def test_one_dead_reference_does_not_break_the_round() -> None:
    """قطع مرجع ⟸ کهنگی همان مرجع؛ مرجع دیگر همان نوبت ذخیره می‌شود."""
    transport = FakeTransport(
        get_responses={
            TALAIR_ENDPOINT: ConnectionError("connection refused"),
            BONBAST_PAGE_ENDPOINT: bonbast_html(),
        },
        post_responses={BONBAST_JSON_ENDPOINT: bonbast_json_text()},
    )
    store = InMemoryStore()

    saved = await collect_reference_round(
        REFERENCE_SOURCES, transport, store, now=FETCHED_AT
    )

    assert {s.reference_slug for s in saved} == {"bonbast"}
    assert await store.get_reference("talair") is None
    assert await store.get_reference("bonbast") is not None
