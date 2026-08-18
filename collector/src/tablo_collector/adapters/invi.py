from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import unknown_fee_snapshot

INVI_WS_ENDPOINT = "wss://invi.ir/ws"
INVI_SUBSCRIBE_MESSAGE = json.dumps({"channel": "markets", "model": "all", "request": "SUBSCRIBE"})
GOLD_MARKET = "goldirr"


def decode_invi_message(raw: str) -> Any | None:
    try:
        message = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(message, dict):
        return None
    markets = message.get("message", {}).get("markets")
    if not isinstance(markets, list):
        return None
    for entry in markets:
        if isinstance(entry, dict) and entry.get("market") == GOLD_MARKET:
            return entry
    return None


class InviAdapter:
    slug = "invi"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = INVI_WS_ENDPOINT
    # ⚠️ invi's "close" is in the same hundred-toman raw unit milli.py uses —
    # confirmed against a live frame against the tala.ir reference at the
    # same moment, not assumed from the field name.
    scale = Decimal("100")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        if not isinstance(payload, dict) or payload.get("market") != GOLD_MARKET:
            raise AdapterError("Invi: payload is not a goldirr market frame")
        price = payload.get("close")
        if price is None:
            raise AdapterError("Invi: close is empty in frame")
        try:
            raw_mid = Decimal(str(price))
        except InvalidOperation as exc:
            raise AdapterError(f"Invi: close is invalid: {price!r}") from exc

        return unknown_fee_snapshot(
            slug=self.slug,
            raw_price=raw_mid,
            scale=self.scale,
            fetched_at=fetched_at,
        )
