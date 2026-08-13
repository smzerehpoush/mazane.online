# ⚠️ مرجع قیمت سکو نیست: هرگز ردیف جدول مقایسه، لینک معرف، `PLATFORMS`،
# فهرست عمومی (`tablo:listed`) یا رأی چک میانه نمی‌شود.
# ⚠️ عدد مرجع فقط با ذکر منبع نمایش داده می‌شود، هرگز به‌عنوان «نرخ مظنه».

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from ..models import Side


class ReferenceInstrument(StrEnum):
    GOLD_18K_TOMAN = "GOLD_18K_TOMAN"


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
