from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import FeeSource, Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import known_fee_snapshot

MILLI_ENDPOINT = "https://milli.gold/api/v1/public/milli-price/external"

MILLI_MANUAL_BUY_FEE = Decimal("0.005")
MILLI_MANUAL_SELL_FEE = Decimal("0.005")
MILLI_FEE_OBSERVED_AT = datetime(2026, 8, 5, tzinfo=UTC)


class MilliAdapter:
    slug = "milli"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = MILLI_ENDPOINT
    scale = Decimal("100")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        if not isinstance(payload, dict):
            raise AdapterError("میلی: payload یک شیء JSON نیست")

        raw_price = (payload.get("data") or {}).get("price18")
        if raw_price is None:
            raise AdapterError("میلی: قیمت price18 در payload تهی است")
        try:
            raw_value = Decimal(str(raw_price))
        except InvalidOperation as exc:
            raise AdapterError(f"میلی: payload نامعتبر: {exc!r}") from exc

        return known_fee_snapshot(
            slug=self.slug,
            raw_price=raw_value,
            scale=self.scale,
            fetched_at=fetched_at,
            buy_fee=MILLI_MANUAL_BUY_FEE,
            sell_fee=MILLI_MANUAL_SELL_FEE,
            fee_source=FeeSource.MANUAL,
            observed_at=MILLI_FEE_OBSERVED_AT,
        )
