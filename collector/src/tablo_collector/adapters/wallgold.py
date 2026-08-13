from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import FeeSource, Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import known_fee_snapshot

WALLGOLD_ENDPOINT = "https://api.wallgold.ir/api/v1/markets"
GOLD_SYMBOL = "GLD_18C_750TMN"


class WallgoldAdapter:
    slug = "wallgold"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = WALLGOLD_ENDPOINT
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

        return known_fee_snapshot(
            slug=self.slug,
            raw_price=raw_value,
            scale=self.scale,
            fetched_at=fetched_at,
            buy_fee=fee,
            sell_fee=fee,
            fee_source=FeeSource.API,
            buy_enabled=market.get("buyStatus") == "enable",
            sell_enabled=market.get("sellStatus") == "enable",
        )

    def _gold_market(self, payload: Any) -> dict[str, Any]:
        try:
            markets = payload["result"]
            return next(m for m in markets if m.get("symbol") == GOLD_SYMBOL)
        except (TypeError, KeyError, StopIteration) as exc:
            raise AdapterError(
                f"وال‌گلد: بازار {GOLD_SYMBOL} در payload پیدا نشد"
            ) from exc
