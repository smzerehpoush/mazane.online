from __future__ import annotations

import json
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Side
from ..pipeline import AdapterError
from . import ReferenceInstrument, ReferenceQuote, ReferenceSnapshot
from .transport import ReferenceTransport

TALAIR_ENDPOINT = "https://www.tala.ir/ajax/price/talair"
TALAIR_BANNER_ENDPOINT = "https://www.tala.ir/banner/?rnd=u5aaE20jsN&ids=,&is-mobile=0&android=0&ios=0&rnd=1263&h=1080&w=1920"
TALAIR_HEADERS = {"Referer": "https://www.tala.ir/"}

_FIELD_TO_INSTRUMENT = {
    "gold_18k": ReferenceInstrument.GOLD_18K_TOMAN,
}

_DIGIT_TRANSLATION = str.maketrans(
    {
        "۰": "0",
        "۱": "1",
        "۲": "2",
        "۳": "3",
        "۴": "4",
        "۵": "5",
        "۶": "6",
        "۷": "7",
        "۸": "8",
        "۹": "9",
        "٠": "0",
        "١": "1",
        "٢": "2",
        "٣": "3",
        "٤": "4",
        "٥": "5",
        "٦": "6",
        "٧": "7",
        "٨": "8",
        "٩": "9",
        "٫": ".",
        "٬": ",",
        "−": "-",
    }
)
_TAG_RE = re.compile(r"<[^>]+>")
_NUMBER_RE = re.compile(r"-?\d+(?:[,.]\d+)*")


def _clean_value(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    text = _TAG_RE.sub("", str(raw)).translate(_DIGIT_TRANSLATION).strip()
    match = _NUMBER_RE.search(text)
    if match is None:
        return None
    text = match.group(0).replace(",", "")
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
        banner_payload = None
        try:
            banner_text = await transport.get_text(
                TALAIR_BANNER_ENDPOINT, headers=TALAIR_HEADERS
            )
            banner_payload = json.loads(banner_text)
        except Exception:
            banner_payload = None
        return self.parse(payload, fetched_at, banner_payload=banner_payload)

    def parse(
        self,
        payload: Any,
        fetched_at: datetime,
        *,
        banner_payload: Any | None = None,
    ) -> ReferenceSnapshot:
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
        banner_price = (
            banner_payload.get("price") if isinstance(banner_payload, dict) else None
        )
        if isinstance(banner_price, dict):
            value = _clean_value(banner_price.get("ounce"))
            if value is not None:
                quotes.append(
                    ReferenceQuote(
                        reference_slug=self.slug,
                        instrument=ReferenceInstrument.XAU,
                        side=Side.PRICE,
                        value=value,
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
