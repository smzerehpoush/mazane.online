"""سازنده‌های مشترک اسنپ‌شات — چهار شکل تکرارشونده.

هر چهار شکل **دقیقاً یک سطر قیمت** تولید می‌کنند (سند تصمیم ۰۰۰۲)؛ تفاوتشان
فقط در این است که آن یک عدد از کجا می‌آید و کارمزد کنارش چه منشأیی دارد:

- **منبع دوقیمتی** (تکنوگلد، طلاین، اکوگلد، زرافزا، بازر): API دو عدد
  می‌دهد ⟸ قیمت = میانگین همان دو، و کارمزد از نصفِ اسپرد استنتاج می‌شود
  ⟸ `fee_source = IMPLIED`.
- **دفتر سفارش** (داریک): قیمت = میانگین دو سرِ دفتر، ولی اسپردِ دفتر
  کارمزد **کسی** نیست (سفارش کاربران دیگر است) ⟸ کارمزد ۰٪ با منشأ
  `MANUAL` (تصمیم مالک ۲۰۲۶-۰۸-۱۰).
- **تک‌قیمتی با کارمزد معلوم** (وال‌گلد، طلاسی، میلی، گلدیکا): همان تک‌عدد
  منتشرشده، و کارمزدها از API یا سند.
- **تک‌قیمتی با کارمزد نامعلوم** (ملی‌گلد، دیجی‌کالا، همراه‌گلد، اینوی):
  همان تک‌عدد، هر دو کارمزد تهی — **جعل نمی‌شود**، و صفرِ ساختگی هم جعل است.

نگاشت سمت‌ها به عهده‌ی هر آداپتر نیست: `ask_bid` (قاعده‌ی ثابت بند ۳.۲ سند
تحقیق ۰۱) اینجا اعمال می‌شود، پس منبعی با نام‌گذاری وارونه (طلاین، زرافزا)
هم درست خوانده می‌شود. مقدار خام هر سطر و ضریب صریحش کنار هم می‌مانند
(قاعده‌ی ۲ قراردادها).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from ..models import (
    FeeSource,
    Instrument,
    PlatformSnapshot,
    PlatformTerms,
    Quote,
    Side,
)
from ..pricing import (
    ask_bid,
    fee_percent,
    implied_side_fee,
    mean_of_pair,
    round_trip_percent,
    to_toman,
)

_ZERO = Decimal("0")


def _price_quote(
    *,
    slug: str,
    raw_value: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    instrument: Instrument = Instrument.GOLD_18K,
) -> Quote:
    return Quote(
        platform_slug=slug,
        instrument=instrument,
        side=Side.PRICE,
        price_toman=to_toman(raw_value * scale),
        raw_value=raw_value,
        raw_scale=scale,
        fetched_at=fetched_at,
    )


def _snapshot(
    *,
    slug: str,
    raw_value: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    buy_fee: Decimal | None,
    sell_fee: Decimal | None,
    fee_source: FeeSource,
    buy_enabled: bool,
    sell_enabled: bool,
    min_order_toman: int | None = None,
    instrument: Instrument = Instrument.GOLD_18K,
    observed_at: datetime | None = None,
) -> PlatformSnapshot:
    """تنها جایی که `PlatformSnapshot` ساخته می‌شود — یک قیمت، دو کارمزد.

    `observed_at` جدا از `fetched_at` است چون چرخه‌ی عمر کارمزد جداست: قیمت
    هر ۳۰ ثانیه تازه می‌شود ولی کارمزد دستی تاریخ مشاهده‌ی خودش را دارد و
    UI همان تاریخ را کنار برچسب «دستی» نشان می‌دهد. نیامد ⟸ همان `fetched_at`.

    دو کارمزد **با هم** می‌آیند یا هیچ‌کدام — همان قید `PlatformTerms`
    («عدد نصفه‌نیمه یعنی باگ»). اینجا هم مثل آنجا صریح بررسی می‌شود تا
    تایپ‌چکر همان تضمین را ببیند، نه یک بولِ واسط.
    """
    if (buy_fee is None) != (sell_fee is None):
        raise ValueError(f"{slug}: کارمزد یک‌سمته یعنی باگ — یا هر دو، یا هیچ‌کدام")

    fees: tuple[Decimal, Decimal, Decimal] | None = (
        None
        if buy_fee is None or sell_fee is None
        else (
            fee_percent(buy_fee),
            fee_percent(sell_fee),
            round_trip_percent(buy_fee, sell_fee),
        )
    )

    terms = PlatformTerms(
        platform_slug=slug,
        buy_fee_percent=None if fees is None else fees[0],
        sell_fee_percent=None if fees is None else fees[1],
        round_trip_percent=None if fees is None else fees[2],
        fee_source=fee_source,
        buy_enabled=buy_enabled,
        sell_enabled=sell_enabled,
        observed_at=observed_at if observed_at is not None else fetched_at,
        min_order_toman=min_order_toman,
    )
    return PlatformSnapshot(
        platform_slug=slug,
        quotes=(
            _price_quote(
                slug=slug,
                raw_value=raw_value,
                scale=scale,
                fetched_at=fetched_at,
                instrument=instrument,
            ),
        ),
        terms=terms,
        fetched_at=fetched_at,
    )


def dealer_snapshot(
    *,
    slug: str,
    raw_first: Decimal,
    raw_second: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    buy_enabled: bool = True,
    sell_enabled: bool = True,
) -> PlatformSnapshot:
    """منبع دوقیمتی: قیمت = میانگین دو عدد خودش، کارمزد استنتاجی از اسپرد.

    ⚠️ تقارن کارمزد دو سمت یک **فرض** است، نه داده‌ی منبع — برای همین
    `IMPLIED` و نه `API` (CONTEXT.md، «کارمزد استنتاجی»).
    """
    raw_ask, raw_bid = ask_bid(raw_first, raw_second)
    fee = implied_side_fee(raw_ask, raw_bid)  # مستقل از ضریب — نسبت است
    return _snapshot(
        slug=slug,
        raw_value=mean_of_pair(raw_ask, raw_bid),
        scale=scale,
        fetched_at=fetched_at,
        buy_fee=fee,
        sell_fee=fee,
        fee_source=FeeSource.IMPLIED,
        buy_enabled=buy_enabled,
        sell_enabled=sell_enabled,
    )


def order_book_snapshot(
    *,
    slug: str,
    raw_first: Decimal,
    raw_second: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    observed_at: datetime | None = None,
) -> PlatformSnapshot:
    """دفتر سفارش دوسمته: قیمت = میانگین دو سرِ دفتر، کارمزد ۰٪.

    اسپردِ دفتر هزینه‌ی واقعی کاربر است ولی **درآمد هیچ‌کس نیست** — سفارشِ
    کاربران دیگر است، نه قیمت‌گذاری سکو. پس به‌عنوان کارمزد ثبت نمی‌شود
    (تصمیم مالک ۲۰۲۶-۰۸-۱۰؛ سند تصمیم ۰۰۰۲) و رفت‌وبرگشت ۰٪ گزارش می‌شود.

    دفتر یک‌سمته اصلاً به اینجا نمی‌رسد: آن نوبت قیمت ندارد و آداپتر
    `AdapterError` می‌دهد ⟸ کهنگی، نه خطا (قاعده‌ی سخت ۵).
    """
    raw_ask, raw_bid = ask_bid(raw_first, raw_second)
    return _snapshot(
        slug=slug,
        raw_value=mean_of_pair(raw_ask, raw_bid),
        scale=scale,
        fetched_at=fetched_at,
        buy_fee=_ZERO,
        sell_fee=_ZERO,
        fee_source=FeeSource.MANUAL,
        buy_enabled=True,
        sell_enabled=True,
        observed_at=observed_at,
    )


def known_fee_snapshot(
    *,
    slug: str,
    raw_price: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    buy_fee: Decimal,
    sell_fee: Decimal,
    fee_source: FeeSource,
    buy_enabled: bool = True,
    sell_enabled: bool = True,
    min_order_toman: int | None = None,
    observed_at: datetime | None = None,
) -> PlatformSnapshot:
    """تک‌قیمتی با کارمزد معلوم: همان عدد منتشرشده + دو کارمزد مستقل.

    دو کارمزد جدا گرفته می‌شوند چون واقعاً مستقل‌اند (گلدیکا نامتقارن است)؛
    برابربودنشان اتفاق است، نه قاعده.
    """
    return _snapshot(
        slug=slug,
        raw_value=raw_price,
        scale=scale,
        fetched_at=fetched_at,
        buy_fee=buy_fee,
        sell_fee=sell_fee,
        fee_source=fee_source,
        buy_enabled=buy_enabled,
        sell_enabled=sell_enabled,
        min_order_toman=min_order_toman,
        observed_at=observed_at,
    )


def unknown_fee_snapshot(
    *,
    slug: str,
    raw_price: Decimal,
    scale: Decimal,
    fetched_at: datetime,
    min_order_toman: int | None = None,
) -> PlatformSnapshot:
    """تک‌قیمتی وقتی کارمزد سکو هیچ‌جا معلوم نیست: قیمت هست، کارمزد تهی.

    قیمتش با بقیه‌ی سکوها هم‌جنس است (همه پیش-از-کارمزدند) و در جدول جدا
    نمی‌افتد؛ فقط ستون کارمزدش تهی می‌ماند.
    """
    return _snapshot(
        slug=slug,
        raw_value=raw_price,
        scale=scale,
        fetched_at=fetched_at,
        buy_fee=None,
        sell_fee=None,
        fee_source=FeeSource.UNKNOWN,
        buy_enabled=True,
        sell_enabled=True,
        min_order_toman=min_order_toman,
    )
