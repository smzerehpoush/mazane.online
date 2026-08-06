"""سازنده‌های مشترک اسنپ‌شات — سه شکل تکرارشونده (بلیت‌های ۴ و ۵).

- **dealer اسپرددار** (تکنوگلد، طلاین، اکوگلد، زرافزا، بازر): API خودش دو
  قیمت مؤثر می‌دهد؛ BUY/SELL همان دو عددند (معتبرترین شکل ممکن)، mid میانگین
  آن‌هاست و کارمزد ضمنی از اسپرد در می‌آید ⟸ `fee_source = API`.
- **تک‌قیمتی با کارمزد نامعلوم** (ملی‌گلد، دیجی‌کالا، همراه‌گلد، اینوی): فقط
  MID ذخیره می‌شود؛ قیمت مؤثر جعل نمی‌شود ⟸ `fee_source = UNKNOWN`.
- **دفتر سفارش یک‌طرفه** (داریک وقتی `bestSell` تهی است — بند ۹.۲ نکته‌ی ۵):
  فقط سمتِ موجودِ دفتر، بدون MID و بدون کارمزد ⟸ سمت غایب «در دسترس نیست».

نگاشت سمت‌ها به عهده‌ی هر آداپتر نیست: `ask_bid` (قاعده‌ی ثابت بند ۳.۲ سند
تحقیق ۰۱) اینجا اعمال می‌شود، پس منبعی با نام‌گذاری وارونه (طلاین، زرافزا)
هم درست ذخیره می‌شود. مقدار خام هر سطر همان عدد منبع برای همان سمت است و
ضریب صریح کنارش می‌ماند (قاعده‌ی ۲ قراردادها).
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
from ..pricing import ask_bid, fee_percent, implied_side_fee, round_trip_percent, to_toman

_TWO = Decimal("2")


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
    """اسنپ‌شات یک dealer اسپرددار از جفت قیمت خام (به هر ترتیبی)."""
    raw_ask, raw_bid = ask_bid(raw_first, raw_second)
    raw_mid = (raw_ask + raw_bid) / _TWO
    fee = implied_side_fee(raw_ask, raw_bid)  # مستقل از ضریب — نسبت است

    def quote(side: Side, raw_value: Decimal) -> Quote:
        return Quote(
            platform_slug=slug,
            instrument=Instrument.GOLD_18K,
            side=side,
            price_toman=to_toman(raw_value * scale),
            raw_value=raw_value,
            raw_scale=scale,
            fetched_at=fetched_at,
        )

    terms = PlatformTerms(
        platform_slug=slug,
        buy_fee_percent=fee_percent(fee),
        sell_fee_percent=fee_percent(fee),
        round_trip_percent=round_trip_percent(fee, fee),
        fee_source=FeeSource.API,
        buy_enabled=buy_enabled,
        sell_enabled=sell_enabled,
        observed_at=fetched_at,
    )

    return PlatformSnapshot(
        platform_slug=slug,
        quotes=(
            quote(Side.MID, raw_mid),
            quote(Side.BUY, raw_ask),
            quote(Side.SELL, raw_bid),
        ),
        terms=terms,
        fetched_at=fetched_at,
    )


def one_sided_book_snapshot(
    *,
    slug: str,
    side: Side,
    raw_value: Decimal,
    scale: Decimal,
    fetched_at: datetime,
) -> PlatformSnapshot:
    """اسنپ‌شات دفتر سفارش وقتی فقط یک سمتش سفارش دارد (بند ۹.۲ نکته‌ی ۵).

    `bestSell` تهی داریک یعنی «این سمت الان در دسترس نیست»، نه خطا: سمتِ
    موجود عین سفارشِ سرِ دفتر ذخیره می‌شود (جعل نیست — مدل همین تک‌سطر
    یک‌طرفه را با UNKNOWN مجاز می‌داند)، سمتِ غایب `*_enabled = False`
    می‌گیرد و چون MID وجود ندارد، سکو خودبه‌خود از رأی چک میانه بیرون است.
    """
    if side not in (Side.BUY, Side.SELL):
        # MID یعنی «قیمت اسمی» و MEAN یعنی «قیمت مرجع سکو» — هیچ‌کدام سفارشِ
        # سرِ دفتر نیستند؛ سطر MEAN را هم فقط خود مدل می‌سازد، نه آداپتر.
        raise ValueError(f"سطر یک‌طرفه‌ی دفتر سفارش فقط BUY یا SELL است، نه {side.value}")
    terms = PlatformTerms(
        platform_slug=slug,
        buy_fee_percent=None,
        sell_fee_percent=None,
        round_trip_percent=None,
        fee_source=FeeSource.UNKNOWN,
        buy_enabled=side is Side.BUY,
        sell_enabled=side is Side.SELL,
        observed_at=fetched_at,
    )

    return PlatformSnapshot(
        platform_slug=slug,
        quotes=(
            Quote(
                platform_slug=slug,
                instrument=Instrument.GOLD_18K,
                side=side,
                price_toman=to_toman(raw_value * scale),
                raw_value=raw_value,
                raw_scale=scale,
                fetched_at=fetched_at,
            ),
        ),
        terms=terms,
        fetched_at=fetched_at,
    )


def unknown_fee_snapshot(
    *,
    slug: str,
    raw_mid: Decimal,
    scale: Decimal,
    fetched_at: datetime,
) -> PlatformSnapshot:
    """اسنپ‌شات تک‌قیمتی وقتی کارمزد سکو هیچ‌جا معلوم نیست: فقط MID."""
    terms = PlatformTerms(
        platform_slug=slug,
        buy_fee_percent=None,
        sell_fee_percent=None,
        round_trip_percent=None,
        fee_source=FeeSource.UNKNOWN,
        buy_enabled=True,
        sell_enabled=True,
        observed_at=fetched_at,
    )

    return PlatformSnapshot(
        platform_slug=slug,
        quotes=(
            Quote(
                platform_slug=slug,
                instrument=Instrument.GOLD_18K,
                side=Side.MID,
                price_toman=to_toman(raw_mid * scale),
                raw_value=raw_mid,
                raw_scale=scale,
                fetched_at=fetched_at,
            ),
        ),
        terms=terms,
        fetched_at=fetched_at,
    )
