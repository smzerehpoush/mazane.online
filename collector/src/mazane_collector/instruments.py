"""موجودیت کامل دارایی + دروازه‌ی انتشار (بند ۱۳، تصمیم ۱۰ — بلیت ۷).

`Instrument` در models.py فقط کد است؛ اینجا هر کد یک موجودیت کامل می‌شود:
اسلاگ لاتین تخت (بند ۱۳، تصمیم ۱۱)، نام فارسی، واحد، عیار و ارز.

**دروازه‌ی انتشار:** دارایی‌ای که کمتر از دو سکوی پشتیبان دارد صفحه‌ی
مقایسه‌ی اختصاصی نمی‌گیرد — کرال و ذخیره می‌شود ولی `published=False`
می‌ماند و لایه‌ی وب برایش 404 می‌دهد و در سایت‌مپ نمی‌آورد. شمار سکوهای
پشتیبان از **رجیستری زنده** می‌آید: کدام آداپترها (فیلد `instruments`
هر آداپتر) این دارایی را تولید می‌کنند، به شرط این‌که سکویشان قابل نمایش
عمومی باشد (`is_listed` — گلدیکای PERMISSION_PENDING هرگز پشتیبان حساب
نمی‌شود چون داده‌اش به سطح عمومی نمی‌رسد).

payload سریال‌شده (`mazane:instruments`) قرارداد لایه‌ی وب است: وب فقط
پرچم `published` را می‌خواند — آستانه و شمارش همین‌جا، در گردآورنده است
(قاعده‌ی ۱ قراردادها: هیچ منطق مشتقی در وب نیست).

عیار فقط جایی پر شده که قطعی است (طلای ۱۸ عیار = ۷۵۰، نقره = ۹۹۰)؛
برای بقیه None است — حدس نمی‌زنیم.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from pydantic import BaseModel, ConfigDict

from .models import Instrument, Platform

#: آستانه‌ی دروازه‌ی انتشار — «دست‌کم دو سکوی پشتیبان» (بند ۱۳، تصمیم ۱۰).
PUBLISH_GATE_MIN_PLATFORMS = 2


class InstrumentInfo(BaseModel):
    """موجودیت دارایی — ثابت، دستی نگهداری می‌شود (مثل Platform)."""

    model_config = ConfigDict(frozen=True)

    instrument: Instrument
    #: اسلاگ لاتین تخت — عضو جدول مرکزی اسلاگ (mazane_collector.slugs).
    slug: str
    name_fa: str
    unit_fa: str
    #: عیار به رقم لاتین («750»، «990») یا None اگر مستند/قطعی نیست.
    purity: str | None
    #: ارز قیمت‌گذاری — «TOMAN» برای سکوهای داخلی، «USD» برای انس جهانی.
    currency: str


INSTRUMENTS: tuple[InstrumentInfo, ...] = (
    InstrumentInfo(
        instrument=Instrument.GOLD_18K,
        slug="tala-18",
        name_fa="طلای ۱۸ عیار",
        unit_fa="گرم",
        purity="750",
        currency="TOMAN",
    ),
    InstrumentInfo(
        instrument=Instrument.ABSHODE_MITHQAL,
        slug="abshode",
        name_fa="طلای آب‌شده (مظنه)",
        unit_fa="مثقال",
        purity=None,  # عیار مظنه در منابع فعلی مستند نشده — حدس نمی‌زنیم.
        currency="TOMAN",
    ),
    InstrumentInfo(
        instrument=Instrument.SILVER_990,
        slug="noghre",
        name_fa="نقره‌ی ۹۹۰",
        unit_fa="گرم",
        purity="990",
        currency="TOMAN",
    ),
    InstrumentInfo(
        instrument=Instrument.XAU,
        slug="ons-jahani",
        name_fa="انس جهانی طلا",
        unit_fa="اونس",
        purity=None,
        currency="USD",
    ),
)


class InstrumentListing(BaseModel):
    """یک سطر payload ‏`mazane:instruments` — قرارداد با لایه‌ی وب.

    `published` همان دروازه‌ی انتشار محاسبه‌شده است؛ وب آن را فقط
    می‌خواند. `supporting_platform_slugs` برای صفحه‌ی دارایی است: کدام
    سکوها این دارایی را عرضه می‌کنند (فقط سکوهای قابل نمایش عمومی).
    """

    model_config = ConfigDict(frozen=True)

    slug: str
    instrument: Instrument
    name_fa: str
    unit_fa: str
    purity: str | None
    currency: str
    supporting_platform_slugs: tuple[str, ...]
    published: bool


class _EmitsInstruments(Protocol):
    """حداقلِ لازم از یک آداپتر برای شمارش پشتیبان‌ها."""

    slug: str
    instruments: tuple[Instrument, ...]


def build_listings(
    adapters: Sequence[_EmitsInstruments], platforms: Sequence[Platform]
) -> tuple[InstrumentListing, ...]:
    """رجیستری زنده ⟸ فهرست دارایی‌ها با وضعیت دروازه.

    پشتیبان = سکوی `is_listed` که آداپترش این دارایی را تولید می‌کند؛
    ترتیب پشتیبان‌ها همان ترتیب `platforms` (ترتیب فهرست عمومی) است.
    با آمدن آداپتر/سکوی دوم برای یک دارایی، `published` در همان نوبتِ
    گردآوری True می‌شود — صفحه‌ی وب خودکار ساخته می‌شود، بدون دیپلوی.
    """
    emitted_by = {adapter.slug: tuple(adapter.instruments) for adapter in adapters}
    listings = []
    for info in INSTRUMENTS:
        supporting = tuple(
            platform.slug
            for platform in platforms
            if platform.is_listed and info.instrument in emitted_by.get(platform.slug, ())
        )
        listings.append(
            InstrumentListing(
                slug=info.slug,
                instrument=info.instrument,
                name_fa=info.name_fa,
                unit_fa=info.unit_fa,
                purity=info.purity,
                currency=info.currency,
                supporting_platform_slugs=supporting,
                published=len(supporting) >= PUBLISH_GATE_MIN_PLATFORMS,
            )
        )
    return tuple(listings)
