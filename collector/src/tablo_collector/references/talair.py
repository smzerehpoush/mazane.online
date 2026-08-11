"""مرجع طلا دات‌آی‌آر — `www.tala.ir/ajax/price/talair` (بند ۱۲.۲).

نکات تأییدشده (سند تحقیق ۰۱، بندهای ۳.۱، ۳.۵ و ۳.۶ + payload واقعی
ضبط‌شده‌ی ۲۰۲۶-۰۸-۰۶):

- خودش می‌گوید پایگاه خبری است و «قیمت‌ها لحظه‌ای نیست» ⟸ مرجع، نه سکو.
- کوکی `_trc` لازم نیست (بند ۳.۵ تصحیح ۳)؛ `Referer` بی‌ضرر است و برای
  احتیاط فرستاده می‌شود.
- اعداد **رشته با جداکننده‌ی هزارگان** اند («18,559,700») و ارقام فارسی
  در `v_fa` — ما فقط `v` را می‌خوانیم.
- ⚠️ داده‌ی خراب دارد (بند ۳.۶): فیلدهایی مثل `gold_mesghal_usd.v = "0"`
  عملاً صفر شده‌اند ⟸ **اعتبارسنجی فیلدبه‌فیلد الزامی است**: صفر/ناخوانا
  یعنی «این فیلد امروز خراب است» و فقط همان فیلد کنار گذاشته می‌شود؛ اگر
  هیچ فیلدی سالم نبود، کل نوبت شکست می‌خورد (کهنگی مرجع، نه سقوط).

فیلد ذخیره‌شده — فقط یکی (سند تصمیم ۰۰۰۲):

- `gold.gold_18k` ⟸ GOLD_18K_TOMAN (تومان بر گرم، ×۱)

مظنه (`gold_bazaruser`) و انس (`gold_ounce`) حذف شدند: جمع‌آوری می‌شدند و
هیچ‌جای سایت نمایش داده نمی‌شدند. تنها مصرف این مرجع نوار «نرخ اتحادیه»
است (سند تصمیم ۰۰۰۱).
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Side
from ..pipeline import AdapterError
from . import ReferenceInstrument, ReferenceQuote, ReferenceSnapshot
from .transport import ReferenceTransport

TALAIR_ENDPOINT = "https://www.tala.ir/ajax/price/talair"
TALAIR_HEADERS = {"Referer": "https://www.tala.ir/"}

_FIELD_TO_INSTRUMENT = {
    "gold_18k": ReferenceInstrument.GOLD_18K_TOMAN,
}


def _clean_value(raw: Any) -> Decimal | None:
    """«18,559,700» ⟸ Decimal؛ صفر/تهی/ناخوانا ⟸ None (فیلد خراب — بند ۳.۶)."""
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


class TalairReference:
    slug = "talair"
    name_fa = "طلا دات‌آی‌آر"
    source_url = "https://www.tala.ir/"
    # ضریب صریح این منبع: واحدِ خودِ فیلد (تومان یا دلار)، ×۱.
    scale = Decimal("1")

    async def collect(
        self, transport: ReferenceTransport, fetched_at: datetime
    ) -> ReferenceSnapshot:
        text = await transport.get_text(TALAIR_ENDPOINT, headers=TALAIR_HEADERS)
        try:
            payload = json.loads(text)
        except ValueError as exc:
            raise AdapterError(f"طلا دات‌آی‌آر: پاسخ JSON نیست: {exc!r}") from exc
        return self.parse(payload, fetched_at)

    def parse(self, payload: Any, fetched_at: datetime) -> ReferenceSnapshot:
        gold = payload.get("gold") if isinstance(payload, dict) else None
        if not isinstance(gold, dict):
            raise AdapterError("طلا دات‌آی‌آر: بدنه‌ی gold در payload پیدا نشد")

        quotes: list[ReferenceQuote] = []
        for field, instrument in _FIELD_TO_INSTRUMENT.items():
            row = gold.get(field)
            raw = row.get("v") if isinstance(row, dict) else None
            value = _clean_value(raw)
            if value is None:
                continue  # فیلد خراب/صفر — فقط همین فیلد کنار می‌رود
            quotes.append(
                ReferenceQuote(
                    reference_slug=self.slug,
                    instrument=instrument,
                    side=Side.PRICE,
                    value=value * self.scale,
                    raw_value=value,
                    raw_scale=self.scale,
                    fetched_at=fetched_at,
                )
            )

        if not quotes:
            raise AdapterError("طلا دات‌آی‌آر: هیچ فیلد سالمی در payload نبود")

        return ReferenceSnapshot(
            reference_slug=self.slug,
            name_fa=self.name_fa,
            source_url=self.source_url,
            quotes=tuple(quotes),
            fetched_at=fetched_at,
        )
