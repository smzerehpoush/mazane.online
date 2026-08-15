from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Side
from ..pipeline import AdapterError
from . import ReferenceInstrument, ReferenceQuote, ReferenceSnapshot
from .transport import ReferenceTransport

TALAIR_ENDPOINT = "https://www.tala.ir/ajax/price/talair"
TALAIR_HEADERS = {"Referer": "https://www.tala.ir/"}

_FIELD_TO_INSTRUMENT = {
    "gold_18k": ReferenceInstrument.GOLD_18K_TOMAN,
}


def _clean_value(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    text = str(raw).replace(",", "").strip()
    if not text:
        return None
    try:
        value = Decimal(text)
    except InvalidOperation:
        return None
    if value <= 0:
        return None
    return value


class TalairReference:
    slug = "talair"
    name_fa = "طلا دات‌آی‌آر"
    source_url = "https://www.tala.ir/"
    scale = Decimal("1")

    async def collect(
        self, transport: ReferenceTransport, fetched_at: datetime
    ) -> ReferenceSnapshot:
        text = await transport.get_text(TALAIR_ENDPOINT, headers=TALAIR_HEADERS)
        try:
            payload = json.loads(text)
        except ValueError as exc:
            raise AdapterError(f"Talair: response is not JSON: {exc!r}") from exc
        return self.parse(payload, fetched_at)

    def parse(self, payload: Any, fetched_at: datetime) -> ReferenceSnapshot:
        gold = payload.get("gold") if isinstance(payload, dict) else None
        if not isinstance(gold, dict):
            raise AdapterError("Talair: gold body not found in payload")

        quotes: list[ReferenceQuote] = []
        for field, instrument in _FIELD_TO_INSTRUMENT.items():
            row = gold.get(field)
            raw = row.get("v") if isinstance(row, dict) else None
            value = _clean_value(raw)
            if value is None:
                continue
            quotes.append(
                ReferenceQuote(
                    reference_slug=self.slug,
                    instrument=instrument,
                    side=Side.PRICE,
                    value=value * self.scale,
                    raw_value=value,
                    raw_scale=self.scale,
                    fetched_at=fetched_at,
                )
            )

        if not quotes:
            raise AdapterError("Talair: no valid field found in payload")

        return ReferenceSnapshot(
            reference_slug=self.slug,
            name_fa=self.name_fa,
            source_url=self.source_url,
            quotes=tuple(quotes),
            fetched_at=fetched_at,
        )
