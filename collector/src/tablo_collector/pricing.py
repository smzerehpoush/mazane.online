"""فرمول‌های هسته — بند ۱ سند معماری. تنها جای مجاز برای این محاسبه‌ها.

round_trip = 1 − (1 − f_sell) / (1 + f_buy)

کارمزدها اعشاری‌اند (۰٫۰۰۵ یعنی نیم درصد).

⚠️ **قیمت مؤثر اینجا نیست و هیچ‌جای دیگر هم نیست** (تصمیم صاحب کسب‌وکار
۲۰۲۶-۰۸-۱۰؛ سند تصمیم ۰۰۰۲): از هر سکو فقط «قیمت» ثبت می‌شود — عدد
منتشرشده‌ی خودش، پیش از هر کارمزد — و کارمزد خرید و فروش جدا ثبت می‌شوند و
**هرگز در قیمت ضرب نمی‌شوند**. `mid × (1 ± f)` از کد حذف شده است؛ اگر روزی
دوباره لازم شد، اول `CONTEXT.md` را عوض کنید.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

_ONE = Decimal("1")
_TOMAN = Decimal("1")
_PERCENT_PLACES = Decimal("0.0001")


def round_trip_percent(buy_fee: Decimal, sell_fee: Decimal) -> Decimal:
    """هزینه‌ی رفت‌وبرگشت به درصد، گرد به چهار رقم اعشار.

    تنها عددی است که هزینه‌ی کل را میان سکوها مقایسه می‌کند (CONTEXT.md،
    «هزینه‌ی رفت‌وبرگشت») — از دو کارمزد ساخته می‌شود، نه از قیمت.
    """
    fraction = _ONE - (_ONE - sell_fee) / (_ONE + buy_fee)
    return (fraction * 100).quantize(_PERCENT_PLACES, rounding=ROUND_HALF_UP)


def to_toman(value: Decimal) -> int:
    """گرد کردن به تومان صحیح، نیم‌بالا — تنها گردکننده‌ی قیمت در کد."""
    return int(value.quantize(_TOMAN, rounding=ROUND_HALF_UP))


def fee_percent(fee: Decimal) -> Decimal:
    """کارمزد اعشاری → درصد، گرد به چهار رقم اعشار (۰٫۰۰۵ → ۰٫۵)."""
    return (fee * 100).quantize(_PERCENT_PLACES, rounding=ROUND_HALF_UP)


def ask_bid(first: Decimal, second: Decimal) -> tuple[Decimal, Decimal]:
    """قاعده‌ی ثابت سند تحقیق ۰۱ (بند ۳.۲): فیلد `buy` در منابع مختلف معنای
    متضاد دارد؛ هرگز به نام فیلد اعتماد نکن —
    ask (آنچه کاربر می‌پردازد) = max، bid (آنچه کاربر می‌گیرد) = min.

    خروجی‌اش دیگر ذخیره نمی‌شود؛ فقط ورودی `mean_of_pair` و
    `implied_side_fee` است تا آن دو به ترتیبِ اتفاقی فیلدهای منبع حساس نباشند.
    """
    return (max(first, second), min(first, second))


def mean_of_pair(ask: Decimal, bid: Decimal) -> Decimal:
    """«قیمت» یک منبع دوقیمتی: میانگین دو عددِ منتشرشده‌ی **خودِ همان سکو**.

    قاعده‌ی قطعی مالک (CONTEXT.md، «قیمت»؛ ۲۰۲۶-۰۸-۱۰): منبع تک‌قیمتی همان
    تک‌عددش ثبت می‌شود و اصلاً از اینجا رد نمی‌شود.

    ⚠️ **میانگین بین‌سکویی نیست** (قاعده‌ی ۴ قراردادها، خط قرمز حقوقی بند
    ۷.۱): هر دو ورودی از یک سکو و یک نوبت گردآوری‌اند.
    """
    return (ask + bid) / 2


def implied_side_fee(ask: Decimal, bid: Decimal) -> Decimal:
    """کارمزد استنتاجی هر سمتِ یک منبع دوقیمتی، اعشاری.

    قیمت = (ask+bid)/2 و اسپرد **متقارن** بین دو سمت پخش می‌شود:
    f = (ask − قیمت)/قیمت = (قیمت − bid)/قیمت = (ask − bid)/(ask + bid).

    ⚠️ تقارن یک **فرض** است، نه داده‌ی منبع (CONTEXT.md، «کارمزد استنتاجی»):
    سکو هیچ کارمزدی اعلام نکرده و ما اسپردش را نصف کرده‌ایم. برای همین
    `FeeSource.IMPLIED` منشأ جداگانه دارد و هرگز زیر برچسب «از API سکو»
    نمایش داده نمی‌شود — ادعای «این سکو فلان‌قدر کارمزد می‌گیرد» را نمی‌کنیم.
    """
    return (ask - bid) / (ask + bid)
