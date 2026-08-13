from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import unknown_fee_snapshot

MELLIGOLD_ENDPOINT = "https://melligold.com/api/v1/exchange/buy-sell-price/?format=json"

_TWO = Decimal("2")


class MelligoldAdapter:
    slug = "melligold"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = MELLIGOLD_ENDPOINT
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        data = (payload or {}).get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise AdapterError("ملی‌گلد: بدنه‌ی data در payload پیدا نشد")

        price_buy = data.get("price_buy")
        price_sell = data.get("price_sell")
        if price_buy is None or price_sell is None:
            raise AdapterError("ملی‌گلد: قیمت price_buy/price_sell در payload تهی است")
        try:
            raw_mid = (Decimal(str(price_buy)) + Decimal(str(price_sell))) / _TWO
        except InvalidOperation as exc:
            raise AdapterError(f"ملی‌گلد: payload نامعتبر: {exc!r}") from exc

        return unknown_fee_snapshot(
            slug=self.slug,
            raw_price=raw_mid,
            scale=self.scale,
            fetched_at=fetched_at,
        )
