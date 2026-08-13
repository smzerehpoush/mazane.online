from __future__ import annotations

from .models import DataPolicy, MarketModel, Platform

# ⚠️ ترتیب این تاپل همان ترتیب فهرست عمومی است — ردیف بی‌قیمت (کارمزد نامعلوم)
# هرگز بالای ردیف قیمت‌دار نمی‌نشیند.
PLATFORMS: tuple[Platform, ...] = (
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
        legal_entity="شرکت توسعه راهکار الوند ارسباران",
        delivery_note_fa="تحویل فیزیکی با اجرت ساخت (نرخ اعلام عمومی نشده)",
        referral_param="r",
    ),
    Platform(
        slug="milli",
        name_fa="میلی",
        data_policy=DataPolicy.ALLOWED,
        name_en="Milli",
        website_url="https://milli.gold",
        delivery_note_fa="کارمزد تحویل فیزیکی ۳٪",
        referral_param="referralCode",
    ),
    Platform(
        slug="technogold",
        name_fa="تکنوگلد",
        data_policy=DataPolicy.ALLOWED,
        name_en="Technogold",
        website_url="https://technogold.gold",
        legal_entity="بازوی فینتک هلدینگ تکنولایف",
        referral_param="referralCode",
    ),
    Platform(
        slug="tlyn",
        name_fa="طلاین",
        data_policy=DataPolicy.ALLOWED,
        name_en="Tlyn",
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
    Platform(
        slug="daric",
        name_fa="داریک",
        data_policy=DataPolicy.ALLOWED,
        market_model=MarketModel.ORDER_BOOK,
        name_en="Daric",
        website_url="https://daric.gold",
    ),
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
        website_url="https://www.digikala.com/wealth/",
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
        website_url="https://pwa.hamrahgold.com",
    ),
    Platform(
        slug="invi",
        name_fa="اینوی",
        data_policy=DataPolicy.ALLOWED,
        name_en="Invi",
        website_url="https://invi.ir",
    ),
    Platform(
        slug="goldika",
        name_fa="گلدیکا",
        data_policy=DataPolicy.PERMISSION_PENDING,
        name_en="Goldika",
        website_url="https://goldika.ir",
    ),
)

# ⚠️ مرجع حقیقت فراداده‌ی سکو همین رجیستری است؛ هر بازسازی از ردیف دیتابیس باید
# از این نگاشت کامل شود، وگرنه فیلدهایی مثل `delivery_note_fa` بی‌صدا گم می‌شوند.
PLATFORM_BY_SLUG: dict[str, Platform] = {p.slug: p for p in PLATFORMS}
_REGISTRY_ORDER: dict[str, int] = {p.slug: i for i, p in enumerate(PLATFORMS)}


def registry_order(slug: str) -> int:
    return _REGISTRY_ORDER.get(slug, len(_REGISTRY_ORDER))
