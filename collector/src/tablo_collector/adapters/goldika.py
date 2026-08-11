"""آداپتر گلدیکا — `goldika.ir/api/v2/public/price`.

نکات تأییدشده (سند تحقیق ۰۱، بندهای ۳.۳ و ۳.۶):

- `data.mid_price` **ریال** بر گرم است ⟸ ضریب صریح ÷۱۰ (بند ۴ سند معماری).
- کارمزد از خود API می‌آید: `data.commission.trade_buy_percent` /
  `trade_sell_percent` (برحسب درصد) ⟸ `fee_source = API`. تحقیق رابطه را
  ریاضی تأیید کرده: `buy = mid × 1.012` دقیقاً — پس محاسبه‌ی مؤثر با همان
  فرمول‌های `pricing.py` با داده‌ی واقعی صحت‌سنجی شده است.
- API فیلد وضعیت باز/بسته ندارد ⟸ هر دو سمت باز فرض می‌شود.

⚠️ حقوقی: `data_policy = PERMISSION_PENDING` (بند ۱۲.۳ سند معماری) —
کرال و ذخیره می‌شود، ولی تا اجازه‌ی کتبی نمایش عمومی ندارد. آن قید در
`platforms.py` و لایه‌ی استور اعمال می‌شود، نه اینجا.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import (
    FeeSource,
    Instrument,
    PlatformSnapshot,
)
from ..pipeline import AdapterError
from .common import known_fee_snapshot

GOLDIKA_ENDPOINT = "https://goldika.ir/api/v2/public/price"

_HUNDRED = Decimal("100")


class GoldikaAdapter:
    slug = "goldika"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = GOLDIKA_ENDPOINT
    # ضریب صریح این منبع: ریال بر گرم، ÷۱۰ به تومان (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("0.1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        data = (payload or {}).get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise AdapterError("گلدیکا: بدنه‌ی data در payload پیدا نشد")

        raw_price = data.get("mid_price")
        if raw_price is None:
            raise AdapterError("گلدیکا: قیمت mid_price در payload تهی است")
        try:
            raw_value = Decimal(str(raw_price))
            commission = data["commission"]
            buy_fee = Decimal(str(commission["trade_buy_percent"])) / _HUNDRED
            sell_fee = Decimal(str(commission["trade_sell_percent"])) / _HUNDRED
        except (InvalidOperation, KeyError, TypeError) as exc:
            raise AdapterError(f"گلدیکا: payload نامعتبر: {exc!r}") from exc

        # تنها سکویی که دو کارمزد **نامتقارن** منتشر می‌کند — دلیل زنده‌ی
        # این‌که چرا کارمزد خرید و فروش دو ستون جدا هستند، نه یکی.
        return known_fee_snapshot(
            slug=self.slug,
            raw_price=raw_value,
            scale=self.scale,
            fetched_at=fetched_at,
            buy_fee=buy_fee,
            sell_fee=sell_fee,
            fee_source=FeeSource.API,
        )
