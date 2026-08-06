"""آداپتر طلاین — `price.tlyn.ir/api/v1/price`.

نکات تأییدشده (سند تحقیق ۰۱، بندهای ۳.۱ تا ۳.۳ و ۳.۶):

- `prices[]` چند نماد دارد (GOLD18، GOLD_MITHQAL17، سکه‌ها و…)؛ مبنای ما
  نماد `GOLD18` است.
- `price.buy` / `price.sell` تومان ÷۱۰۰۰ ⟸ ضریب صریح ×۱۰۰۰.
- ⚠️ نام‌گذاری «دید فروشنده» (بند ۳.۲): `sell` **بزرگ‌تر** است و همان است
  که کاربر می‌پردازد — وارونه‌ی شهود. نگاشت با قاعده‌ی ثابت `ask_bid` انجام
  می‌شود، نه با اعتماد به نام فیلد.
- کارمزد در خود اسپرد API است (بند ۳.۸: رفت‌وبرگشت ~۰٫۸٪) ⟸ `fee_source = API`.
- `status` نماد («enabled») به‌عنوان وضعیت باز بودن هر دو سمت خوانده می‌شود.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import dealer_snapshot

TLYN_ENDPOINT = "https://price.tlyn.ir/api/v1/price"
GOLD_SYMBOL = "GOLD18"


class TlynAdapter:
    slug = "tlyn"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = TLYN_ENDPOINT
    # ضریب صریح این منبع: تومان ÷۱۰۰۰، ×۱۰۰۰ به تومان بر گرم
    # (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("1000")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        gold = self._gold_row(payload)

        price = gold.get("price") or {}
        buy = price.get("buy")
        sell = price.get("sell")
        if buy is None or sell is None:
            raise AdapterError("طلاین: قیمت buy/sell نماد GOLD18 در payload تهی است")
        try:
            raw_buy = Decimal(str(buy))
            raw_sell = Decimal(str(sell))
        except InvalidOperation as exc:
            raise AdapterError(f"طلاین: payload نامعتبر: {exc!r}") from exc

        enabled = gold.get("status") == "enabled"
        return dealer_snapshot(
            slug=self.slug,
            raw_first=raw_buy,
            raw_second=raw_sell,
            scale=self.scale,
            fetched_at=fetched_at,
            buy_enabled=enabled,
            sell_enabled=enabled,
        )

    def _gold_row(self, payload: Any) -> dict[str, Any]:
        try:
            rows = payload["prices"]
            return next(r for r in rows if r.get("symbol") == GOLD_SYMBOL)
        except (TypeError, KeyError, StopIteration) as exc:
            raise AdapterError(
                f"طلاین: نماد {GOLD_SYMBOL} در payload پیدا نشد"
            ) from exc
