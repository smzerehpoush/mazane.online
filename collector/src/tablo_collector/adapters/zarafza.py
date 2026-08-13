from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import dealer_snapshot

ZARAFZA_ENDPOINT = "https://api.zarafza.com/wallets/v1/prices"


class ZarafzaAdapter:
    slug = "zarafza"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = ZARAFZA_ENDPOINT
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        data = (payload or {}).get("data") if isinstance(payload, dict) else None
        g18 = data.get("G18") if isinstance(data, dict) else None
        if not isinstance(g18, dict):
            raise AdapterError("زرافزا: بدنه‌ی data.G18 در payload پیدا نشد")

        sell_price = (g18.get("sell") or {}).get("price")
        buy_price = (g18.get("buy") or {}).get("price")
        if sell_price is None or buy_price is None:
            raise AdapterError("زرافزا: قیمت sell.price/buy.price در payload تهی است")
        try:
            raw_sell = Decimal(str(sell_price))
            raw_buy = Decimal(str(buy_price))
        except InvalidOperation as exc:
            raise AdapterError(f"زرافزا: payload نامعتبر: {exc!r}") from exc

        return dealer_snapshot(
            slug=self.slug,
            raw_first=raw_sell,
            raw_second=raw_buy,
            scale=self.scale,
            fetched_at=fetched_at,
        )
