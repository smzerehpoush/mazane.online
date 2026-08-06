"""فهرست سکوهای نسخه‌ی ۱ و سیاست داده‌ی هرکدام — بند ۱۲.۳ سند معماری.

گلدیکا تا گرفتن اجازه‌ی کتبی `PERMISSION_PENDING` است: کرال و ذخیره می‌شود،
ولی در فهرست عمومی (آنچه لایه‌ی وب می‌خواند) هرگز نمی‌آید. این تصمیم اینجا
و در لایه‌ی استور اعمال می‌شود، نه با فیلتر در کامپوننت‌های وب.
"""

from __future__ import annotations

from .models import DataPolicy, Platform

PLATFORMS: tuple[Platform, ...] = (
    Platform(slug="wallgold", name_fa="وال‌گلد", data_policy=DataPolicy.ALLOWED),
    Platform(slug="talasea", name_fa="طلاسی", data_policy=DataPolicy.ALLOWED),
    Platform(slug="milli", name_fa="میلی", data_policy=DataPolicy.ALLOWED),
    # شرایط استفاده‌ی گلدیکا استخراج داده را صریحاً ممنوع کرده (سند تحقیق ۰۱،
    # بند ۵) ⟸ تا اجازه‌ی کتبی، نمایش عمومی ندارد (بند ۱۳، تصمیم ۱۲).
    Platform(slug="goldika", name_fa="گلدیکا", data_policy=DataPolicy.PERMISSION_PENDING),
)
