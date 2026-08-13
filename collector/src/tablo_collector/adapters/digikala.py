from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import unknown_fee_snapshot

DIGIKALA_ENDPOINT = "https://api.digikala.com/non-inventory/v1/prices/"


class DigikalaAdapter:
    slug = "digikala"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = DIGIKALA_ENDPOINT
    scale = Decimal("100")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        gold18 = (payload or {}).get("gold18") if isinstance(payload, dict) else None
        if not isinstance(gold18, dict):
            raise AdapterError("دیجی‌کالا: بدنه‌ی gold18 در payload پیدا نشد")

        raw_price = gold18.get("price")
        if raw_price is None:
            raise AdapterError("دیجی‌کالا: قیمت gold18.price در payload تهی است")
        try:
            raw_mid = Decimal(str(raw_price))
        except InvalidOperation as exc:
            raise AdapterError(f"دیجی‌کالا: payload نامعتبر: {exc!r}") from exc

        return unknown_fee_snapshot(
            slug=self.slug,
            raw_price=raw_mid,
            scale=self.scale,
            fetched_at=fetched_at,
        )
