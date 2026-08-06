"""آداپتر همراه‌گلد — `pwa.hamrahgold.com/api/v1/market/price/xau/changes`.

نکات تأییدشده (سند تحقیق ۰۱، بندهای ۳.۳ تا ۳.۵ و ۸.۲):

- `data.current` **ریال** بر گرم ⟸ ضریب صریح ÷۱۰ به تومان.
- فقط یک قیمت با `type: "buy"` (بند ۳.۴) — سند تحقیق همین عدد را به‌عنوان
  قیمت سکو گرفته؛ کارمزدی هم هیچ‌جا منتشر نشده ⟸ `fee_source = UNKNOWN`:
  فقط MID، بدون قیمت مؤثر جعلی.
- بدون هیچ کلید یا هدر خاصی ۲۰۰ می‌دهد — `x-api-key` لازم نیست (بند ۳.۵،
  دوباره تأییدشده در بند ۸.۲).
- `data.changes` تاریخچه‌ی آماده‌ی ‎1h/4h/1d/1w/1mo است (بند ۳.۶) — برای
  نمودار بلیت‌های بعدی؛ این آداپتر استفاده‌اش نمی‌کند.
- API فیلد وضعیت باز/بسته ندارد ⟸ هر دو سمت باز فرض می‌شود.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import PlatformSnapshot
from ..pipeline import AdapterError
from .common import unknown_fee_snapshot

HAMRAHGOLD_ENDPOINT = "https://pwa.hamrahgold.com/api/v1/market/price/xau/changes"


class HamrahgoldAdapter:
    slug = "hamrahgold"
    endpoint = HAMRAHGOLD_ENDPOINT
    # ضریب صریح این منبع: ریال بر گرم، ÷۱۰ به تومان (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("0.1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        data = (payload or {}).get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise AdapterError("همراه‌گلد: بدنه‌ی data در payload پیدا نشد")

        raw_price = data.get("current")
        if raw_price is None:
            raise AdapterError("همراه‌گلد: قیمت data.current در payload تهی است")
        try:
            raw_mid = Decimal(str(raw_price))
        except InvalidOperation as exc:
            raise AdapterError(f"همراه‌گلد: payload نامعتبر: {exc!r}") from exc

        return unknown_fee_snapshot(
            slug=self.slug,
            raw_mid=raw_mid,
            scale=self.scale,
            fetched_at=fetched_at,
        )
