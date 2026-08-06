"""آداپتر وال‌گلد — `api.wallgold.ir/api/v1/markets`.

لنگر نسخه‌ی ۱: تنها سکو با پورتال رسمی توسعه‌دهنده و robots.txt کاملاً باز
(سند تحقیق ۰۱، بند ۵). نکات تأییدشده:

- قیمت `marketCap.lastPrice` تومان بر گرم است ⟸ ضریب صریح ×۱.
- اسپرد صفر است (`lastBuyPrice == lastSellPrice`)؛ کارمزد جدا در
  `otcFeeCoefficient` می‌آید ⟸ `fee_source = API`.
- `buyStatus` / `sellStatus` وضعیت باز بودن سمت خرید/فروش است.
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

WALLGOLD_ENDPOINT = "https://api.wallgold.ir/api/v1/markets"
GOLD_SYMBOL = "GLD_18C_750TMN"


class WallgoldAdapter:
    slug = "wallgold"
    endpoint = WALLGOLD_ENDPOINT
    # ضریب صریح این منبع: تومان بر گرم، ×۱ (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        market = self._gold_market(payload)

        raw_price = (market.get("marketCap") or {}).get("lastPrice")
        if raw_price is None:
            raise AdapterError("وال‌گلد: قیمت طلای ۱۸ عیار در payload تهی است")
        try:
            raw_value = Decimal(str(raw_price))
            fee = Decimal(str(market["otcFeeCoefficient"]))
        except (InvalidOperation, KeyError) as exc:
            raise AdapterError(f"وال‌گلد: payload نامعتبر: {exc!r}") from exc

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
            buy_enabled=market.get("buyStatus") == "enable",
            sell_enabled=market.get("sellStatus") == "enable",
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

    def _gold_market(self, payload: Any) -> dict[str, Any]:
        try:
            markets = payload["result"]
            return next(m for m in markets if m.get("symbol") == GOLD_SYMBOL)
        except (TypeError, KeyError, StopIteration) as exc:
            raise AdapterError(
                f"وال‌گلد: بازار {GOLD_SYMBOL} در payload پیدا نشد"
            ) from exc
