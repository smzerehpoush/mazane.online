"""آداپتر ملی‌گلد — `melligold.com/api/v1/exchange/buy-sell-price/?format=json`.

نکات تأییدشده (سند تحقیق ۰۱، بندهای ۳.۱ تا ۳.۴ و ۸.۲):

- `data.price_buy` / `data.price_sell` تومان بر گرم ⟸ ضریب صریح ×۱.
- **اسپرد صفر** (بند ۳.۴): دو قیمت دقیقاً برابرند و کارمزد جدا گرفته
  می‌شود — ولی هیچ‌جا (نه API نه سایت) منتشر نشده ⟸ `fee_source = UNKNOWN`:
  فقط mid (میانگین آن دو) ذخیره می‌شود و قیمت مؤثر جعل نمی‌شود.
- ⚠️ خود endpoint پشت دست‌دهی ArvanCloud است (بند ۸.۲): ریدایرکت ۳۰۷ +
  کوکی — **auth نیست**؛ کلاینت فقط باید cookie jar داشته باشد. به فیکسچر و
  parse ربطی ندارد.
- API فیلد وضعیت باز/بسته ندارد ⟸ هر دو سمت باز فرض می‌شود.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import unknown_fee_snapshot

MELLIGOLD_ENDPOINT = "https://melligold.com/api/v1/exchange/buy-sell-price/?format=json"

_TWO = Decimal("2")


class MelligoldAdapter:
    slug = "melligold"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = MELLIGOLD_ENDPOINT
    # ضریب صریح این منبع: تومان بر گرم، ×۱ (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        data = (payload or {}).get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise AdapterError("ملی‌گلد: بدنه‌ی data در payload پیدا نشد")

        price_buy = data.get("price_buy")
        price_sell = data.get("price_sell")
        if price_buy is None or price_sell is None:
            raise AdapterError("ملی‌گلد: قیمت price_buy/price_sell در payload تهی است")
        try:
            # اسپرد صفر است؛ میانگین برای روزی که دو عدد از هم جدا شوند.
            raw_mid = (Decimal(str(price_buy)) + Decimal(str(price_sell))) / _TWO
        except InvalidOperation as exc:
            raise AdapterError(f"ملی‌گلد: payload نامعتبر: {exc!r}") from exc

        return unknown_fee_snapshot(
            slug=self.slug,
            raw_mid=raw_mid,
            scale=self.scale,
            fetched_at=fetched_at,
        )
