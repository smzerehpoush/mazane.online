"""مراجع قیمت — طلا دات‌آی‌آر و بن‌بست (بند ۱۲.۲ سند معماری).

مرجع قیمت **سکو نیست**: قاعده‌ی بند ۹.۳ (دامنه‌ی مصرف‌کننده + endpoint
معامله) را ندارد ⟸ هرگز ردیف جدول مقایسه نمی‌شود، لینک معرف ندارد و در
`PLATFORMS` و فهرست عمومی (`mazane:listed`) نمی‌آید. کاربردش نمودار مرجع،
چک سلامت و محتوای بلاگ است و قید بند ۷.۱ درباره‌اش مطلق است: **عددش فقط با
ذکر منبع** نمایش داده می‌شود، هرگز به‌عنوان «نرخ مظنه» — برای همین
`ReferenceSnapshot` نام و نشانی منبع را داخل خودِ داده‌ی ذخیره‌شده حمل
می‌کند، نه در یک جدول جانبی که بشود گمش کرد.

مدل جدا از `Quote` است چون واحدها جدا هستند: انس جهانی دلاری است و مظنه
بر مثقال — «همیشه تومان بر گرم» سکوها اینجا صادق نیست. `raw_value` و
`raw_scale` مثل سکوها همیشه می‌ماند (قاعده‌ی ۲ قراردادها).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from ..models import Side


class ReferenceInstrument(StrEnum):
    """واحد هر عضو در نامش صریح است — ضریب هر مرجع در آداپترش."""

    GOLD_18K_TOMAN = "GOLD_18K_TOMAN"  # تومان بر گرم طلای ۱۸ عیار
    ABSHODE_MITHQAL_TOMAN = "ABSHODE_MITHQAL_TOMAN"  # تومان بر مثقال آب‌شده (مظنه)
    XAU_USD = "XAU_USD"  # دلار بر اونس جهانی
    USD_TOMAN = "USD_TOMAN"  # تومان بر دلار آمریکا


class ReferenceQuote(BaseModel):
    """یک عدد مرجع، همیشه با واحد صریح در instrument و خامِ قابل بازسازی."""

    model_config = ConfigDict(frozen=True)

    reference_slug: str
    instrument: ReferenceInstrument
    side: Side
    value: Decimal
    raw_value: Decimal
    raw_scale: Decimal
    fetched_at: datetime


class ReferenceSnapshot(BaseModel):
    """خروجی یک نوبت گردآوری موفق یک مرجع — با ذکر منبع داخل خود داده."""

    model_config = ConfigDict(frozen=True)

    reference_slug: str
    name_fa: str
    source_url: str
    quotes: tuple[ReferenceQuote, ...]
    fetched_at: datetime
