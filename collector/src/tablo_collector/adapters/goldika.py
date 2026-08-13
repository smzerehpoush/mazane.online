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

        return known_fee_snapshot(
            slug=self.slug,
            raw_price=raw_value,
            scale=self.scale,
            fetched_at=fetched_at,
            buy_fee=buy_fee,
            sell_fee=sell_fee,
            fee_source=FeeSource.API,
        )
