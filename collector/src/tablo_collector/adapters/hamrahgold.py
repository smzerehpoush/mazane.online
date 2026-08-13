from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import unknown_fee_snapshot

HAMRAHGOLD_ENDPOINT = "https://pwa.hamrahgold.com/api/v1/market/price/xau/changes"


class HamrahgoldAdapter:
    slug = "hamrahgold"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = HAMRAHGOLD_ENDPOINT
    scale = Decimal("0.1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        data = (payload or {}).get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise AdapterError("همراه‌گلد: بدنه‌ی data در payload پیدا نشد")

        raw_price = data.get("current")
        if raw_price is None:
            raise AdapterError("همراه‌گلد: قیمت data.current در payload تهی است")
        try:
            raw_mid = Decimal(str(raw_price))
        except InvalidOperation as exc:
            raise AdapterError(f"همراه‌گلد: payload نامعتبر: {exc!r}") from exc

        return unknown_fee_snapshot(
            slug=self.slug,
            raw_price=raw_mid,
            scale=self.scale,
            fetched_at=fetched_at,
        )
