"""آداپتر طلاسی — `api.talasea.ir/api/market/getGoldPrice`.

نکات تأییدشده (سند تحقیق ۰۱، بندهای ۳.۳ و ۳.۶):

- `price` تومان بر **میلی‌گرم** است ⟸ ضریب صریح ×۱۰۰۰ (بند ۴ سند معماری).
- کارمزد از خود API می‌آید: `fee` (و `feeTable` پلکانی، برای ماشین‌حساب
  بلیت‌های بعدی) ⟸ `fee_source = API`.
- `disableBuy` / `disableSell` وضعیت باز بودن هر سمت است — قابلیتی که هیچ
  رقیبی ندارد (بند ۵ سند معماری).
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

TALASEA_ENDPOINT = "https://api.talasea.ir/api/market/getGoldPrice"


class TalaseaAdapter:
    slug = "talasea"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = TALASEA_ENDPOINT
    # ضریب صریح این منبع: تومان بر میلی‌گرم، ×۱۰۰۰ (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("1000")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        if not isinstance(payload, dict):
            raise AdapterError("طلاسی: payload یک شیء JSON نیست")

        raw_price = payload.get("price")
        if raw_price is None:
            raise AdapterError("طلاسی: قیمت در payload تهی است")
        try:
            raw_value = Decimal(str(raw_price))
            fee = Decimal(str(payload["fee"]))
        except (InvalidOperation, KeyError) as exc:
            raise AdapterError(f"طلاسی: payload نامعتبر: {exc!r}") from exc

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
            buy_fee_percent=fee * 100,
            sell_fee_percent=fee * 100,
            round_trip_percent=round_trip_percent(fee, fee),
            fee_source=FeeSource.API,
            buy_enabled=not payload.get("disableBuy", False),
            sell_enabled=not payload.get("disableSell", False),
            observed_at=fetched_at,
        )

        return PlatformSnapshot(
            platform_slug=self.slug,
            quotes=(
                quote(Side.MID, mid_toman),
                quote(Side.BUY, effective_buy_toman(Decimal(mid_toman), fee)),
                quote(Side.SELL, effective_sell_toman(Decimal(mid_toman), fee)),
            ),
            terms=terms,
            fetched_at=fetched_at,
        )
