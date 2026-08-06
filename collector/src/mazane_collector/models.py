"""مدل‌های داده — بند ۲.۲ سند معماری.

`raw_value` و `raw_scale` همیشه ذخیره می‌شوند تا اگر روزی ضریب منبعی اشتباه
از آب درآمد، تاریخچه قابل بازسازی باشد. `fee_source` تفکیک می‌کند که کارمزد
از API آمده یا دستی ثبت شده است.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class Side(StrEnum):
    BUY = "BUY"
    SELL = "SELL"
    MID = "MID"


class Instrument(StrEnum):
    GOLD_18K = "GOLD_18K"
    ABSHODE_MITHQAL = "ABSHODE_MITHQAL"
    SILVER_990 = "SILVER_990"
    XAU = "XAU"


class FeeSource(StrEnum):
    API = "API"
    MANUAL = "MANUAL"


class Quote(BaseModel):
    """یک قیمت منتسب به یک سکو، همیشه تومان بر گرم.

    برای سطرهای BUY/SELL مقدار `price_toman` قیمت «مؤثر» است (با کارمزد)،
    محاسبه‌شده در گردآورنده — لایه‌ی وب هیچ فرمولی ندارد.
    """

    model_config = ConfigDict(frozen=True)

    platform_slug: str
    instrument: Instrument
    side: Side
    price_toman: int
    raw_value: Decimal
    raw_scale: Decimal
    fetched_at: datetime


class PlatformTerms(BaseModel):
    """شرایط تجاری سکو — چرخه‌ی عمر جدا از قیمت (کارمزد شاید ماهی یک‌بار عوض شود)."""

    model_config = ConfigDict(frozen=True)

    platform_slug: str
    buy_fee_percent: Decimal
    sell_fee_percent: Decimal
    round_trip_percent: Decimal
    fee_source: FeeSource
    buy_enabled: bool
    sell_enabled: bool
    observed_at: datetime


class PlatformSnapshot(BaseModel):
    """خروجی یک نوبت گردآوری موفق برای یک سکو: قیمت‌ها + شرایط."""

    model_config = ConfigDict(frozen=True)

    platform_slug: str
    quotes: tuple[Quote, ...]
    terms: PlatformTerms
    fetched_at: datetime
