from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import unknown_fee_snapshot

INVI_WS_ENDPOINT = "wss://invi.ir/ws"
GOLD_SYMBOL = "GOLD18"


def decode_invi_message(raw: str) -> Any | None:
    try:
        message = json.loads(raw)
    except ValueError:
        return None
    if isinstance(message, dict) and message.get("symbol") == GOLD_SYMBOL:
        return message
    return None


class InviAdapter:
    slug = "invi"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = INVI_WS_ENDPOINT
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        if not isinstance(payload, dict) or payload.get("symbol") != GOLD_SYMBOL:
            raise AdapterError("Invi: payload is not a GOLD18 price frame")
        price = payload.get("price")
        if price is None:
            raise AdapterError("Invi: price is empty in frame")
        try:
            raw_mid = Decimal(str(price))
        except InvalidOperation as exc:
            raise AdapterError(f"Invi: price is invalid: {price!r}") from exc

        return unknown_fee_snapshot(
            slug=self.slug,
            raw_price=raw_mid,
            scale=self.scale,
            fetched_at=fetched_at,
        )
