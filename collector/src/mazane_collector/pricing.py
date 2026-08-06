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
