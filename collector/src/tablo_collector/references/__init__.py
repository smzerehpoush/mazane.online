"""مرجع قیمت — امروز فقط طلا دات‌آی‌آر (بند ۱۲.۲ سند معماری).

مرجع قیمت **سکو نیست**: قاعده‌ی بند ۹.۳ (دامنه‌ی مصرف‌کننده + endpoint
معامله) را ندارد ⟸ هرگز ردیف جدول مقایسه نمی‌شود، لینک معرف ندارد، در
`PLATFORMS` و فهرست عمومی (`tablo:listed`) نمی‌آید و در رأی چک میانه هم
شرکت نمی‌کند. تنها مصرفش نوار «نرخ اتحادیه» است و قید بند ۷.۱ درباره‌اش
مطلق است: **عددش فقط با ذکر منبع** نمایش داده می‌شود، هرگز به‌عنوان «نرخ
مظنه» — برای همین `ReferenceSnapshot` نام و نشانی منبع را داخل خودِ
داده‌ی ذخیره‌شده حمل می‌کند، نه در یک جدول جانبی که بشود گمش کرد.

⚠️ بن‌بست حذف شد و از تلا فقط ۱۸ عیار می‌ماند (سند تصمیم ۰۰۰۲): هر دو
جمع‌آوری می‌شدند و هیچ‌جای سایت نمایش داده نمی‌شدند. اگر روزی مرجع تازه‌ای
اضافه شد، اول باید معلوم باشد کجای سایت دیده می‌شود.

مدل جدا از `Quote` است چون سرنوشتش جداست: مرجع در جدول خودش می‌نشیند و
هرگز با قیمت سکوها قاطی نمی‌شود. `raw_value` و `raw_scale` مثل سکوها همیشه
می‌ماند (قاعده‌ی ۲ قراردادها).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from ..models import Side


class ReferenceInstrument(StrEnum):
    """واحد هر عضو در نامش صریح است — ضریب هر مرجع در آداپترش.

    مثقال، انس و دلار حذف شدند (سند تصمیم ۰۰۰۲): جمع‌آوری می‌شدند و هیچ‌جای
    سایت نمایش داده نمی‌شدند.
    """

    GOLD_18K_TOMAN = "GOLD_18K_TOMAN"  # تومان بر گرم طلای ۱۸ عیار


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
