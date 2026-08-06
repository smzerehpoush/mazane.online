"""فهرست سکوهای نسخه‌ی ۱ و سیاست داده‌ی هرکدام — بند ۱۲.۳ سند معماری.

تصمیم ۲۰/۲۲ دفتر تصمیم‌ها: همه‌ی سکوها `ALLOWED` و قابل نمایش‌اند جز
گلدیکا که تا گرفتن اجازه‌ی کتبی `PERMISSION_PENDING` است: کرال و ذخیره
می‌شود، ولی در فهرست عمومی (آنچه لایه‌ی وب می‌خواند) هرگز نمی‌آید. این
تصمیم اینجا و در لایه‌ی استور اعمال می‌شود، نه با فیلتر در کامپوننت‌های وب.

**ترتیب این تاپل، ترتیب فهرست عمومی است** (استورها همین ترتیب را حفظ
می‌کنند): اول سکوهایی که قیمت مؤثر دارند، بعد سکوهای کارمزد-نامعلوم
(`fee_source = UNKNOWN`: ملی‌گلد، دیجی‌کالا، همراه‌گلد) که ردیفشان «قیمت
در دسترس نیست» رندر می‌شود — ردیف بی‌قیمت نباید بالای ردیف قیمت‌دار بنشیند.
"""

from __future__ import annotations

from .models import DataPolicy, Platform

PLATFORMS: tuple[Platform, ...] = (
    # ― قیمت مؤثر معلوم (کارمزد از API یا ثبت دستی) ―
    Platform(slug="wallgold", name_fa="وال‌گلد", data_policy=DataPolicy.ALLOWED),
    Platform(slug="talasea", name_fa="طلاسی", data_policy=DataPolicy.ALLOWED),
    Platform(slug="milli", name_fa="میلی", data_policy=DataPolicy.ALLOWED),
    Platform(slug="technogold", name_fa="تکنوگلد", data_policy=DataPolicy.ALLOWED),
    Platform(slug="tlyn", name_fa="طلاین", data_policy=DataPolicy.ALLOWED),
    Platform(slug="ecogold", name_fa="اکوگلد", data_policy=DataPolicy.ALLOWED),
    Platform(slug="zarafza", name_fa="زرافزا", data_policy=DataPolicy.ALLOWED),
    Platform(slug="baazar", name_fa="بازر", data_policy=DataPolicy.ALLOWED),
    # ― کارمزد نامعلوم (UNKNOWN): بعد از قیمت‌دارها ―
    Platform(slug="melligold", name_fa="ملی‌گلد", data_policy=DataPolicy.ALLOWED),
    Platform(slug="digikala", name_fa="دیجی‌کالا", data_policy=DataPolicy.ALLOWED),
    Platform(slug="hamrahgold", name_fa="همراه‌گلد", data_policy=DataPolicy.ALLOWED),
    # شرایط استفاده‌ی گلدیکا استخراج داده را صریحاً ممنوع کرده (سند تحقیق ۰۱،
    # بند ۵) ⟸ تا اجازه‌ی کتبی، نمایش عمومی ندارد (بند ۱۳، تصمیم ۱۲).
    Platform(slug="goldika", name_fa="گلدیکا", data_policy=DataPolicy.PERMISSION_PENDING),
)
