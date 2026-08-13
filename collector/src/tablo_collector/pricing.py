from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

# ⚠️ کارمزد هرگز در قیمت ضرب نمی‌شود — «قیمت مؤثر» در کد وجود ندارد.

_ONE = Decimal("1")
_TOMAN = Decimal("1")
_PERCENT_PLACES = Decimal("0.0001")


def round_trip_percent(buy_fee: Decimal, sell_fee: Decimal) -> Decimal:
    fraction = _ONE - (_ONE - sell_fee) / (_ONE + buy_fee)
    return (fraction * 100).quantize(_PERCENT_PLACES, rounding=ROUND_HALF_UP)


def to_toman(value: Decimal) -> int:
    return int(value.quantize(_TOMAN, rounding=ROUND_HALF_UP))


def fee_percent(fee: Decimal) -> Decimal:
    return (fee * 100).quantize(_PERCENT_PLACES, rounding=ROUND_HALF_UP)


# ⚠️ هرگز به نام فیلد منبع اعتماد نکن — ask بیشینه است و bid کمینه.
def ask_bid(first: Decimal, second: Decimal) -> tuple[Decimal, Decimal]:
    return (max(first, second), min(first, second))


# ⚠️ میانگین بین‌سکویی نیست — هر دو ورودی از یک سکو و یک نوبت گردآوری‌اند.
def mean_of_pair(ask: Decimal, bid: Decimal) -> Decimal:
    return (ask + bid) / 2


def implied_side_fee(ask: Decimal, bid: Decimal) -> Decimal:
    return (ask - bid) / (ask + bid)
