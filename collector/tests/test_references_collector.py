"""مرز گردآورنده‌ی مرجع قیمت: فیکسچر ⟸ ردیف‌های مرجع در استور (بند ۱۲.۲).

فیکسچر واقعی ضبط‌شده‌ی ۲۰۲۶-۰۸-۰۶ (بدون هیچ تماس شبکه‌ای در تست):

- `talair_price.json` — پاسخ `GET www.tala.ir/ajax/price/talair`؛ همین
  payload زنده فیلد خراب هم دارد (`gold_mesghal_usd.v = "0"`، بازار بسته).

قواعد قفل‌شده: مرجع سکو نیست (هرگز در فهرست عمومی نمی‌آید)، عددش همیشه با
ذکر منبع ذخیره می‌شود، و مراجع به‌کلی بیرون از رأی چک میانه‌اند (docstring
ماژول references.pipeline).

⚠️ بن‌بست حذف شد و از تلا فقط ۱۸ عیار می‌ماند (سند تصمیم ۰۰۰۲): هر دو
جمع‌آوری می‌شدند و هیچ‌جای سایت دیده نمی‌شدند. تنها مصرف این لایه نوار
«نرخ اتحادیه» است.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.models import Side
from tablo_collector.pipeline import AdapterError
from tablo_collector.platforms import PLATFORMS
from tablo_collector.references import ReferenceInstrument
from tablo_collector.references.pipeline import REFERENCE_SOURCES, collect_reference_round
from tablo_collector.references.talair import TALAIR_ENDPOINT, TalairReference
from tablo_collector.store.memory import InMemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def talair_payload() -> Any:
    return json.loads((FIXTURES / "talair_price.json").read_text(encoding="utf-8"))


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
        get_responses={TALAIR_ENDPOINT: json.dumps(talair_payload())},
        post_responses={},
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

    # فقط ۱۸ عیار — مظنه و انس دیگر خوانده نمی‌شوند.
    assert [q.instrument for q in stored.quotes] == [ReferenceInstrument.GOLD_18K_TOMAN]
    quote = stored.quotes[0]
    # رشته‌ی هزارگان‌دار «18,559,700» ⟸ عدد، با ضریب صریح ×۱.
    assert quote.value == Decimal("18559700")
    assert quote.side is Side.PRICE
    assert quote.raw_scale == Decimal("1")
    assert quote.value == quote.raw_value * quote.raw_scale


async def test_talair_broken_gold_18k_means_stale_reference_not_bad_data() -> None:
    """tala.ir داده‌ی خراب دارد (بند ۳.۶ سند تحقیق): فیلد صفرشده کنار می‌رود.

    حالا که تنها همین یک فیلد خوانده می‌شود، خرابی‌اش یعنی کل نوبت مرجع
    کهنه می‌ماند — نه ردیف تهی، نه صفر (قاعده‌ی سخت ۵).
    """
    payload = talair_payload()
    payload["gold"]["gold_18k"]["v"] = "0"  # همان الگوی خرابی زنده‌ی arz_dolar
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


# ― قواعد سراسری مراجع ―


async def test_references_are_stored_but_never_platforms_nor_listed() -> None:
    """معیار پذیرش بلیت ۵: داده‌ی مرجع ذخیره می‌شود ولی در جدول مقایسه
    (فهرست عمومی سکوها) نمی‌آید — نه ردیف، نه لینک معرف."""
    store = InMemoryStore()
    await store.save_platforms(PLATFORMS)

    saved = await collect_reference_round(
        REFERENCE_SOURCES, full_transport(), store, now=FETCHED_AT
    )
    assert {s.reference_slug for s in saved} == {"talair"}

    # در استور مرجع هست…
    assert await store.get_reference("talair") is not None
    # …و در تاریخچه (آرشیو الزام حقوقی — بند ۷.۱).
    assert {s.reference_slug for s in store.reference_history} == {"talair"}

    # …ولی هرگز سکو نیست: نه در فهرست عمومی، نه در PLATFORMS، نه در کلید سکوها.
    listed_slugs = {p.slug for p in await store.get_listed_platforms()}
    assert "talair" not in listed_slugs
    assert "talair" not in {p.slug for p in PLATFORMS}
    assert await store.get_snapshot("talair") is None


async def test_dead_reference_does_not_break_the_round() -> None:
    """قطع مرجع ⟸ کهنگی همان مرجع؛ نوبت سالم تمام می‌شود (قاعده‌ی سخت ۵)."""
    transport = FakeTransport(
        get_responses={TALAIR_ENDPOINT: ConnectionError("connection refused")},
        post_responses={},
    )
    store = InMemoryStore()

    saved = await collect_reference_round(
        REFERENCE_SOURCES, transport, store, now=FETCHED_AT
    )

    assert saved == ()
    assert await store.get_reference("talair") is None


async def test_bonbast_is_gone_from_the_reference_roster() -> None:
    """سند تصمیم ۰۰۰۲: تنها مرجع فعال تلاست. اگر روزی مرجع تازه‌ای اضافه شد،
    اول باید معلوم باشد کجای سایت دیده می‌شود."""
    assert [source.slug for source in REFERENCE_SOURCES] == ["talair"]
