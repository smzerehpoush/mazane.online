"""فهرست سکوهای نسخه‌ی ۱ و سیاست داده‌ی هرکدام — بند ۱۲.۳ سند معماری.

تصمیم ۲۰/۲۲ دفتر تصمیم‌ها: همه‌ی سکوها `ALLOWED` و قابل نمایش‌اند جز
گلدیکا که تا گرفتن اجازه‌ی کتبی `PERMISSION_PENDING` است: کرال و ذخیره
می‌شود، ولی در فهرست عمومی (آنچه لایه‌ی وب می‌خواند) هرگز نمی‌آید. این
تصمیم اینجا و در لایه‌ی استور اعمال می‌شود، نه با فیلتر در کامپوننت‌های وب.

**ترتیب این تاپل، ترتیب فهرست عمومی است** (استورها همین ترتیب را حفظ
می‌کنند): اول سکوهایی که قیمت مؤثر دارند، بعد سکوهای کارمزد-نامعلوم
(`fee_source = UNKNOWN`: ملی‌گلد، دیجی‌کالا، همراه‌گلد، اینوی) که ردیفشان
«قیمت در دسترس نیست» رندر می‌شود — ردیف بی‌قیمت نباید بالای ردیف قیمت‌دار
بنشیند.

مراجع قیمت (طلا دات‌آی‌آر، بن‌بست — بند ۱۲.۲) سکو نیستند و **اینجا نمی‌آیند**؛
فهرستشان در `mazane_collector.references` است و هرگز وارد فهرست عمومی نمی‌شود.

فراداده‌ی صفحه‌ی سکو (بلیت ۷ — `name_en`، `website_url`، `legal_entity`،
`delivery_note_fa`) فقط از سند تحقیق ۰۱ (بندهای ۲.۱، ۳.۸ و ۸) پر شده؛
جایی که مستند نیست None مانده — **حدس ممنوع.**
"""

from __future__ import annotations

from .models import DataPolicy, MarketModel, Platform

PLATFORMS: tuple[Platform, ...] = (
    # ― قیمت مؤثر معلوم (کارمزد از API یا ثبت دستی) ―
    Platform(
        slug="wallgold",
        name_fa="وال‌گلد",
        data_policy=DataPolicy.ALLOWED,
        name_en="Wallgold",
        website_url="https://wallgold.ir",
    ),
    Platform(
        slug="talasea",
        name_fa="طلاسی",
        data_policy=DataPolicy.ALLOWED,
        name_en="Talasea",
        website_url="https://talasea.ir",
        # از <title> خودشان — سند تحقیق ۰۱، بند ۲.۱.
        legal_entity="شرکت توسعه راهکار الوند ارسباران",
        # سند تحقیق ۰۱، بند ۹: تحویل فیزیکی با اجرت ساخت (نرخ منتشرنشده).
        delivery_note_fa="تحویل فیزیکی با اجرت ساخت (نرخ اعلام عمومی نشده)",
    ),
    Platform(
        slug="milli",
        name_fa="میلی",
        data_policy=DataPolicy.ALLOWED,
        name_en="Milli",
        website_url="https://milli.gold",
        # سند تحقیق ۰۱، بند ۳.۸ (تأییدشده): تحویل فیزیکی ۳٪.
        delivery_note_fa="کارمزد تحویل فیزیکی ۳٪",
    ),
    Platform(
        slug="technogold",
        name_fa="تکنوگلد",
        data_policy=DataPolicy.ALLOWED,
        name_en="Technogold",
        website_url="https://technogold.gold",
        # سند تحقیق ۰۱، بند ۲.۱: بازوی فینتک هلدینگ تکنولایف.
        legal_entity="بازوی فینتک هلدینگ تکنولایف",
    ),
    Platform(
        slug="tlyn",
        name_fa="طلاین",
        data_policy=DataPolicy.ALLOWED,
        name_en="Tlyn",
        # دامنه‌ی مستند سند تحقیق ۰۱ بند ۲.۱: taline.ir (از tlyn.ir).
        website_url="https://taline.ir",
    ),
    Platform(
        slug="ecogold",
        name_fa="اکوگلد",
        data_policy=DataPolicy.ALLOWED,
        name_en="Ecogold",
        website_url="https://ecogold.ir",
    ),
    Platform(
        slug="zarafza",
        name_fa="زرافزا",
        data_policy=DataPolicy.ALLOWED,
        name_en="Zarafza",
        website_url="https://zarafza.com",
    ),
    Platform(
        slug="baazar",
        name_fa="بازر",
        data_policy=DataPolicy.ALLOWED,
        name_en="Baazar",
        website_url="https://baazar.ir",
    ),
    # داریک دو خوراک (REST + وب‌سوکت دفتر سفارش) و **یک** سکو است (بند ۱۲.۳)؛
    # تنها ORDER_BOOK فهرست: لایه‌ی وب از همین فیلد برچسب «دفتر سفارش» می‌زند.
    Platform(
        slug="daric",
        name_fa="داریک",
        data_policy=DataPolicy.ALLOWED,
        market_model=MarketModel.ORDER_BOOK,
        name_en="Daric",
        website_url="https://daric.gold",
    ),
    # ― کارمزد نامعلوم (UNKNOWN): بعد از قیمت‌دارها ―
    Platform(
        slug="melligold",
        name_fa="ملی‌گلد",
        data_policy=DataPolicy.ALLOWED,
        name_en="Melligold",
        website_url="https://melligold.com",
    ),
    Platform(
        slug="digikala",
        name_fa="دیجی‌کالا",
        data_policy=DataPolicy.ALLOWED,
        name_en="Digikala",
        website_url="https://www.digikala.com",
        # سند تحقیق ۰۱، بند ۸ (تأییدشده): تحویل طلا از ۵٫۴ گرم؛ کارمزد ضرب و
        # تحویل ۴۰۰ میلی‌گرم به‌ازای هر شمش ۵ گرمی (عملاً حدود ۸٪).
        delivery_note_fa=(
            "تحویل فیزیکی طلا از ۵٫۴ گرم؛ کارمزد ضرب و تحویل ۴۰۰ میلی‌گرم "
            "به‌ازای هر شمش ۵ گرمی (عملاً حدود ۸٪)"
        ),
    ),
    Platform(
        slug="hamrahgold",
        name_fa="همراه‌گلد",
        data_policy=DataPolicy.ALLOWED,
        name_en="Hamrahgold",
        # فقط PWA پاسخ می‌دهد؛ دامنه‌ی اصلی بالا نیامد (سند تحقیق ۰۱، بند ۲.۱).
        website_url="https://pwa.hamrahgold.com",
    ),
    # اینوی فقط وب‌سوکت دارد (بند ۱۲.۱ ردیف ۱۴)؛ کارمزدش هیچ‌جا منتشر نشده
    # ⟸ فقط MID (سند تحقیق ۰۱، بند ۲.۲: «تأییدنشده» — شکل فریم فرضی است).
    Platform(
        slug="invi",
        name_fa="اینوی",
        data_policy=DataPolicy.ALLOWED,
        name_en="Invi",
        website_url="https://invi.ir",
    ),
    # شرایط استفاده‌ی گلدیکا استخراج داده را صریحاً ممنوع کرده (سند تحقیق ۰۱،
    # بند ۵) ⟸ تا اجازه‌ی کتبی، نمایش عمومی ندارد (بند ۱۳، تصمیم ۱۲).
    Platform(
        slug="goldika",
        name_fa="گلدیکا",
        data_policy=DataPolicy.PERMISSION_PENDING,
        name_en="Goldika",
        website_url="https://goldika.ir",
    ),
)
