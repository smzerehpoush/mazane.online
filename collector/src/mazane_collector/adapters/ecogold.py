"""آداپتر اکوگلد — `backend.ecogold.ir/api/prices/otc`.

نکات تأییدشده (سند تحقیق ۰۱، بندهای ۳.۱ تا ۳.۳ و ۳.۶):

- `data[]` چند نماد دارد (`GOLD18-IRT`، `SILVER999-IRT`)؛ مبنای ما
  `GOLD18-IRT` است. قیمت‌ها رشته‌ی اعشاری‌اند.
- پسوند `-IRT` یعنی تومان بر گرم ⟸ ضریب صریح ×۱.
- نام‌گذاری «دید کاربر» (بند ۳.۲): `buy_price` بزرگ‌تر = آنچه کاربر
  می‌پردازد؛ نگاشت با قاعده‌ی ثابت `ask_bid`.
- کارمزد در خود اسپرد API است — ارزان‌ترین رفت‌وبرگشت بازار (~۰٫۲۱٪،
  بند ۳.۸) ⟸ `fee_source = API`.
- هر سطر `signature` (JWT) و `valid_at` دارد — برای اثبات منشأ قیمت؛ فعلاً
  استفاده نمی‌شود.
- API فیلد وضعیت باز/بسته ندارد ⟸ هر دو سمت باز فرض می‌شود.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import dealer_snapshot

ECOGOLD_ENDPOINT = "https://backend.ecogold.ir/api/prices/otc"
GOLD_SYMBOL = "GOLD18-IRT"


class EcogoldAdapter:
    slug = "ecogold"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = ECOGOLD_ENDPOINT
    # ضریب صریح این منبع: تومان بر گرم، ×۱ (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        gold = self._gold_row(payload)

        buy_price = gold.get("buy_price")
        sell_price = gold.get("sell_price")
        if buy_price is None or sell_price is None:
            raise AdapterError("اکوگلد: قیمت buy_price/sell_price در payload تهی است")
        try:
            raw_buy = Decimal(str(buy_price))
            raw_sell = Decimal(str(sell_price))
        except InvalidOperation as exc:
            raise AdapterError(f"اکوگلد: payload نامعتبر: {exc!r}") from exc

        return dealer_snapshot(
            slug=self.slug,
            raw_first=raw_buy,
            raw_second=raw_sell,
            scale=self.scale,
            fetched_at=fetched_at,
        )

    def _gold_row(self, payload: Any) -> dict[str, Any]:
        try:
            rows = payload["data"]
            return next(r for r in rows if r.get("symbol") == GOLD_SYMBOL)
        except (TypeError, KeyError, StopIteration) as exc:
            raise AdapterError(
                f"اکوگلد: نماد {GOLD_SYMBOL} در payload پیدا نشد"
            ) from exc
