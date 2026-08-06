"""مرجع بن‌بست — صفحه‌ی HTML `bonbast.com` (بند ۱۲.۲).

بن‌بست API عمومی ندارد؛ صفحه‌ی اصلی یک توکن گردان داخل جاوااسکریپت دارد
(`$.post('/json', {param: "…"})`) و قیمت‌ها را از `POST /json` می‌گیرد.
گردش دو-مرحله‌ای (راستی‌آزمایی‌شده‌ی ۲۰۲۶-۰۸-۰۶ با payload واقعی):

1. `GET bonbast.com/` ⟸ استخراج توکن با `extract_json_param` (مقاوم به
   بهم‌ریختگی HTML — regex فقط روی الگوی همان فراخوانی).
2. `POST bonbast.com/json` با همان کوکی‌ها + `X-Requested-With` ⟸ JSON
   تخت با کلیدهایی مثل `usd1/usd2`، `gol18`، `mithqal`، `ounce`.
   توکن کهنه فقط `{"rest": "1"}` می‌دهد ⟸ `AdapterError` (کهنگی مرجع).

⚠️ **بن‌بست تومان است، نه ریال** (سند تحقیق ۰۱، بند ۳.۵ خطای ۱ — با دو
تأیید مستقل): ضریب ×۱ می‌ماند؛ اگر کسی ÷۱۰ اعمال کند خطای ۱۰۰۰٪ ساخته
است. تست فیکسچر همین را قفل می‌کند.

فیلدهای ذخیره‌شده (دامنه‌ی بلیت ۵: دلار + انس + طلای مرجع):

- `usd1`/`usd2` ⟸ USD_TOMAN دو سمت، با قاعده‌ی ثابت `ask_bid`
- `ounce`       ⟸ XAU_USD
- `gol18`       ⟸ GOLD_18K_TOMAN
- `mithqal`     ⟸ ABSHODE_MITHQAL_TOMAN

تتر که بند ۱۲.۲ نام می‌بَرد در payload زنده‌ی ۲۰۲۶-۰۸-۰۶ وجود نداشت
(هیچ کلید usdt/tether ای) — اگر روزی اضافه شد، اینجا نگاشت بگیرد.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Side
from ..pipeline import AdapterError
from ..pricing import ask_bid
from . import ReferenceInstrument, ReferenceQuote, ReferenceSnapshot
from .transport import ReferenceTransport

BONBAST_PAGE_ENDPOINT = "https://bonbast.com/"
BONBAST_JSON_ENDPOINT = "https://bonbast.com/json"
BONBAST_JSON_HEADERS = {
    "Referer": BONBAST_PAGE_ENDPOINT,
    "X-Requested-With": "XMLHttpRequest",
}

# فقط الگوی خود فراخوانی: $.post('/json', {param: "<token>"}
_PARAM_PATTERN = re.compile(
    r"""\$\.post\(\s*['"]/json['"]\s*,\s*\{\s*param\s*:\s*['"](?P<param>[^'"]+)['"]"""
)

_MID_FIELD_TO_INSTRUMENT = {
    "gol18": ReferenceInstrument.GOLD_18K_TOMAN,
    "mithqal": ReferenceInstrument.ABSHODE_MITHQAL_TOMAN,
    "ounce": ReferenceInstrument.XAU_USD,
}


def extract_json_param(html: str) -> str:
    """توکن `POST /json` از HTML صفحه؛ نبودنش یعنی صفحه عوض شده — خطا."""
    match = _PARAM_PATTERN.search(html)
    if match is None:
        raise AdapterError("بن‌بست: توکن param در HTML صفحه پیدا نشد")
    return match.group("param")


def _clean_value(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    text = str(raw).replace(",", "").strip()
    if not text:
        return None
    try:
        value = Decimal(text)
    except InvalidOperation:
        return None
    if value <= 0:
        return None
    return value


class BonbastReference:
    slug = "bonbast"
    name_fa = "بن‌بست"
    source_url = BONBAST_PAGE_ENDPOINT
    # ضریب صریح این منبع: تومان (نه ریال! بند ۳.۵ سند تحقیق)، ×۱.
    scale = Decimal("1")

    async def collect(
        self, transport: ReferenceTransport, fetched_at: datetime
    ) -> ReferenceSnapshot:
        html = await transport.get_text(BONBAST_PAGE_ENDPOINT)
        param = extract_json_param(html)
        text = await transport.post_form(
            BONBAST_JSON_ENDPOINT, {"param": param}, headers=BONBAST_JSON_HEADERS
        )
        try:
            payload = json.loads(text)
        except ValueError as exc:
            raise AdapterError(f"بن‌بست: پاسخ /json نامعتبر است: {exc!r}") from exc
        return self.parse(payload, fetched_at)

    def parse(self, payload: Any, fetched_at: datetime) -> ReferenceSnapshot:
        if not isinstance(payload, dict):
            raise AdapterError("بن‌بست: payload شیء JSON نیست")

        def quote(
            instrument: ReferenceInstrument, side: Side, value: Decimal
        ) -> ReferenceQuote:
            return ReferenceQuote(
                reference_slug=self.slug,
                instrument=instrument,
                side=side,
                value=value * self.scale,
                raw_value=value,
                raw_scale=self.scale,
                fetched_at=fetched_at,
            )

        quotes: list[ReferenceQuote] = []

        # دلار دو عدد دارد؛ نگاشت سمت با قاعده‌ی ثابت ask_bid، نه نام فیلد.
        usd_first = _clean_value(payload.get("usd1"))
        usd_second = _clean_value(payload.get("usd2"))
        if usd_first is not None and usd_second is not None:
            usd_ask, usd_bid = ask_bid(usd_first, usd_second)
            quotes.append(quote(ReferenceInstrument.USD_TOMAN, Side.BUY, usd_ask))
            quotes.append(quote(ReferenceInstrument.USD_TOMAN, Side.SELL, usd_bid))

        for field, instrument in _MID_FIELD_TO_INSTRUMENT.items():
            value = _clean_value(payload.get(field))
            if value is not None:
                quotes.append(quote(instrument, Side.MID, value))

        if not quotes:
            # توکن کهنه ({"rest": "1"}) یا صفحه‌ی دگرگون‌شده — کهنگی مرجع.
            raise AdapterError("بن‌بست: هیچ فیلد قیمتی در payload نبود")

        return ReferenceSnapshot(
            reference_slug=self.slug,
            name_fa=self.name_fa,
            source_url=self.source_url,
            quotes=tuple(quotes),
            fetched_at=fetched_at,
        )
