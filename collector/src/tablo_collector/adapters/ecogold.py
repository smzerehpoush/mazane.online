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
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        gold = self._gold_row(payload)

        buy_price = gold.get("buy_price")
        sell_price = gold.get("sell_price")
        if buy_price is None or sell_price is None:
            raise AdapterError("Ecogold: buy_price/sell_price is empty in payload")
        try:
            raw_buy = Decimal(str(buy_price))
            raw_sell = Decimal(str(sell_price))
        except InvalidOperation as exc:
            raise AdapterError(f"Ecogold: invalid payload: {exc!r}") from exc

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
                f"Ecogold: symbol {GOLD_SYMBOL} not found in payload"
            ) from exc
