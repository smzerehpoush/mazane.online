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
    scale = Decimal("1000")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        gold = self._gold_row(payload)

        price = gold.get("price") or {}
        buy = price.get("buy")
        sell = price.get("sell")
        if buy is None or sell is None:
            raise AdapterError("Tlyn: buy/sell price of symbol GOLD18 is empty in payload")
        try:
            raw_buy = Decimal(str(buy))
            raw_sell = Decimal(str(sell))
        except InvalidOperation as exc:
            raise AdapterError(f"Tlyn: invalid payload: {exc!r}") from exc

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
                f"Tlyn: symbol {GOLD_SYMBOL} not found in payload"
            ) from exc
