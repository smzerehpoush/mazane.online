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

TALASEA_ENDPOINT = "https://api.talasea.ir/api/market/getGoldPrice"


class TalaseaAdapter:
    slug = "talasea"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = TALASEA_ENDPOINT
    scale = Decimal("1000")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        if not isinstance(payload, dict):
            raise AdapterError("Talasea: payload is not a JSON object")

        raw_price = payload.get("price")
        if raw_price is None:
            raise AdapterError("Talasea: price is empty in payload")
        try:
            raw_value = Decimal(str(raw_price))
            fee = Decimal(str(payload["fee"]))
        except (InvalidOperation, KeyError) as exc:
            raise AdapterError(f"Talasea: invalid payload: {exc!r}") from exc

        return known_fee_snapshot(
            slug=self.slug,
            raw_price=raw_value,
            scale=self.scale,
            fetched_at=fetched_at,
            buy_fee=fee,
            sell_fee=fee,
            fee_source=FeeSource.API,
            buy_enabled=not payload.get("disableBuy", False),
            sell_enabled=not payload.get("disableSell", False),
        )
