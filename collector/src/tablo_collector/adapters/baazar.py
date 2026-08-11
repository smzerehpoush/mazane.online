"""آداپتر بازر — `api.baazar.ir/landing/v1/price/DAILY/30`.

نکات تأییدشده (سند تحقیق ۰۱، بندهای ۳.۱ تا ۳.۳ و ۳.۶):

- `data.buyPrice` / `data.sellPrice` **ریال** بر گرم ⟸ ضریب صریح ÷۱۰.
- نام‌گذاری «دید کاربر» (بند ۳.۲): `buyPrice` بزرگ‌تر = آنچه کاربر
  می‌پردازد؛ نگاشت با قاعده‌ی ثابت `ask_bid`.
- کارمزد در خود اسپرد API است (بند ۳.۸: رفت‌وبرگشت ~۱٫۱۳٪) ⟸
  `fee_source = API`.
- `data.prices[]` تاریخچه‌ی ۳۰ روزه است (بند ۳.۶) — این آداپتر استفاده‌اش
  نمی‌کند.
- API فیلد وضعیت باز/بسته ندارد ⟸ هر دو سمت باز فرض می‌شود.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import dealer_snapshot

BAAZAR_ENDPOINT = "https://api.baazar.ir/landing/v1/price/DAILY/30"


class BaazarAdapter:
    slug = "baazar"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = BAAZAR_ENDPOINT
    # ضریب صریح این منبع: ریال بر گرم، ÷۱۰ به تومان (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("0.1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        data = (payload or {}).get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise AdapterError("بازر: بدنه‌ی data در payload پیدا نشد")

        buy_price = data.get("buyPrice")
        sell_price = data.get("sellPrice")
        if buy_price is None or sell_price is None:
            raise AdapterError("بازر: قیمت buyPrice/sellPrice در payload تهی است")
        try:
            raw_buy = Decimal(str(buy_price))
            raw_sell = Decimal(str(sell_price))
        except InvalidOperation as exc:
            raise AdapterError(f"بازر: payload نامعتبر: {exc!r}") from exc

        return dealer_snapshot(
            slug=self.slug,
            raw_first=raw_buy,
            raw_second=raw_sell,
            scale=self.scale,
            fetched_at=fetched_at,
        )
