from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import dealer_snapshot

TECHNOGOLD_ENDPOINT = "https://api2.technogold.gold/customer/tradeables/only-price/1"


class TechnogoldAdapter:
    slug = "technogold"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = TECHNOGOLD_ENDPOINT
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        results = (payload or {}).get("results") if isinstance(payload, dict) else None
        if not isinstance(results, dict):
            raise AdapterError("تکنوگلد: بدنه‌ی results در payload پیدا نشد")

        buy_price = results.get("buy_price")
        sell_price = results.get("sell_price")
        if buy_price is None or sell_price is None:
            raise AdapterError("تکنوگلد: قیمت buy_price/sell_price در payload تهی است")
        try:
            raw_buy = Decimal(str(buy_price))
            raw_sell = Decimal(str(sell_price))
        except InvalidOperation as exc:
            raise AdapterError(f"تکنوگلد: payload نامعتبر: {exc!r}") from exc

        return dealer_snapshot(
            slug=self.slug,
            raw_first=raw_buy,
            raw_second=raw_sell,
            scale=self.scale,
            fetched_at=fetched_at,
        )
