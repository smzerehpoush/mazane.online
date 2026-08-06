"""فرمول‌های هسته — بند ۱ سند معماری. تنها جای مجاز برای این محاسبه‌ها.

eff_buy   = mid × (1 + f_buy)
eff_sell  = mid × (1 − f_sell)
round_trip = 1 − (1 − f_sell) / (1 + f_buy)

کارمزدها اعشاری‌اند (۰٫۰۰۵ یعنی نیم درصد).
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

_ONE = Decimal("1")
_TOMAN = Decimal("1")
_PERCENT_PLACES = Decimal("0.0001")


def effective_buy_toman(mid_toman: Decimal, buy_fee: Decimal) -> int:
    """قیمت مؤثر خرید (آنچه کاربر واقعاً می‌پردازد)، گرد به تومان."""
    return int((mid_toman * (_ONE + buy_fee)).quantize(_TOMAN, rounding=ROUND_HALF_UP))


def effective_sell_toman(mid_toman: Decimal, sell_fee: Decimal) -> int:
    """قیمت مؤثر فروش (آنچه کاربر واقعاً می‌گیرد)، گرد به تومان."""
    return int((mid_toman * (_ONE - sell_fee)).quantize(_TOMAN, rounding=ROUND_HALF_UP))


def round_trip_percent(buy_fee: Decimal, sell_fee: Decimal) -> Decimal:
    """هزینه‌ی رفت‌وبرگشت به درصد، گرد به چهار رقم اعشار."""
    fraction = _ONE - (_ONE - sell_fee) / (_ONE + buy_fee)
    return (fraction * 100).quantize(_PERCENT_PLACES, rounding=ROUND_HALF_UP)


def reference_price_toman(effective_buy: int, effective_sell: int) -> int:
    """قیمت مرجع یک سکوی **دوسمته** = میانگین مؤثر خرید و فروش خودِ همان سکو،
    گرد به تومان (بند ۱۳، تصمیم ۱۹).

    این تابع فقط شاخه‌ی «دو عدد» از قاعده‌ی قطعی قیمت مرجع سکوست (تصمیم صاحب
    کسب‌وکار ۲۰۲۶-۰۸-۰۶): سکوی تک‌قیمتی همان تک‌عددش مرجع است و اصلاً از
    اینجا رد نمی‌شود؛ دفتر سفارشِ یک‌طرفه هم قیمت مرجع ندارد و جعل نمی‌شود.
    قاعده‌ی کامل و سطرِ ماندگارش در `models.Side.MEAN` است. میانگین بین‌سکویی
    هرگز تولید نمی‌شود (قاعده‌ی ۴ قراردادها)."""
    return to_toman((Decimal(effective_buy) + Decimal(effective_sell)) / 2)


def to_toman(value: Decimal) -> int:
    """گرد کردن به تومان صحیح، نیم‌بالا — تنها گردکننده‌ی قیمت در کد."""
    return int(value.quantize(_TOMAN, rounding=ROUND_HALF_UP))


def fee_percent(fee: Decimal) -> Decimal:
    """کارمزد اعشاری → درصد، گرد به چهار رقم اعشار (۰٫۰۰۵ → ۰٫۵)."""
    return (fee * 100).quantize(_PERCENT_PLACES, rounding=ROUND_HALF_UP)


def ask_bid(first: Decimal, second: Decimal) -> tuple[Decimal, Decimal]:
    """قاعده‌ی ثابت سند تحقیق ۰۱ (بند ۳.۲): فیلد `buy` در منابع مختلف معنای
    متضاد دارد؛ هرگز به نام فیلد اعتماد نکن —
    ask (آنچه کاربر می‌پردازد) = max، bid (آنچه کاربر می‌گیرد) = min."""
    return (max(first, second), min(first, second))


def implied_side_fee(ask: Decimal, bid: Decimal) -> Decimal:
    """کارمزد ضمنی هر سمت یک dealer اسپرددار، اعشاری.

    mid = (ask+bid)/2 و هر دو سمت متقارن‌اند:
    f = (ask − mid)/mid = (mid − bid)/mid = (ask − bid)/(ask + bid)؛
    پس mid×(1+f) = ask و mid×(1−f) = bid — همان فرمول‌های بند ۱ سند معماری،
    و رفت‌وبرگشت round_trip_percent(f, f) = 1 − bid/ask (بند ۳.۸ سند تحقیق).
    """
    return (ask - bid) / (ask + bid)
