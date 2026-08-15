# ⚠️ Not a platform price reference: it never becomes a comparison-table row,
# a referral link, `PLATFORMS`, the public listing (`tablo:listed`), or a median/sanity-check vote.
# ⚠️ The reference figure is only ever shown with its source cited, never as a "quoted rate".

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from ..models import Side


class ReferenceInstrument(StrEnum):
    GOLD_18K_TOMAN = "GOLD_18K_TOMAN"
    XAU = "XAU"
    USD_TOMAN = "USD_TOMAN"
    SEKEH_EMAMI_TOMAN = "SEKEH_EMAMI_TOMAN"
    SEKEH_HALF_TOMAN = "SEKEH_HALF_TOMAN"
    SEKEH_QUARTER_TOMAN = "SEKEH_QUARTER_TOMAN"


class ReferenceQuote(BaseModel):
    model_config = ConfigDict(frozen=True)

    reference_slug: str
    instrument: ReferenceInstrument
    side: Side
    value: Decimal
    raw_value: Decimal
    raw_scale: Decimal
    fetched_at: datetime


class ReferenceSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    reference_slug: str
    name_fa: str
    source_url: str
    quotes: tuple[ReferenceQuote, ...]
    fetched_at: datetime
