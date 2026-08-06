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
    PlatformTerms,
    Quote,
    Side,
)
from ..pipeline import AdapterError
from ..pricing import effective_buy_toman, effective_sell_toman, round_trip_percent

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

        mid_toman = int(raw_value * self.scale)

        def quote(side: Side, price_toman: int) -> Quote:
            return Quote(
                platform_slug=self.slug,
                instrument=Instrument.GOLD_18K,
                side=side,
                price_toman=price_toman,
                raw_value=raw_value,
                raw_scale=self.scale,
                fetched_at=fetched_at,
            )

        terms = PlatformTerms(
            platform_slug=self.slug,
            buy_fee_percent=buy_fee * 100,
            sell_fee_percent=sell_fee * 100,
            round_trip_percent=round_trip_percent(buy_fee, sell_fee),
            fee_source=FeeSource.API,
            buy_enabled=True,
            sell_enabled=True,
            observed_at=fetched_at,
        )

        return PlatformSnapshot(
            platform_slug=self.slug,
            quotes=(
                quote(Side.MID, mid_toman),
                quote(Side.BUY, effective_buy_toman(Decimal(mid_toman), buy_fee)),
                quote(Side.SELL, effective_sell_toman(Decimal(mid_toman), sell_fee)),
            ),
            terms=terms,
            fetched_at=fetched_at,
        )
