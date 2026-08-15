from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

# ⚠️ Fees are never multiplied into the price — there is no "effective price" in the code.

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


# ⚠️ Never trust the source field's name — ask is the max, bid is the min.
def ask_bid(first: Decimal, second: Decimal) -> tuple[Decimal, Decimal]:
    return (max(first, second), min(first, second))


# ⚠️ Not a cross-platform average — both inputs come from a single platform and a single collection round.
def mean_of_pair(ask: Decimal, bid: Decimal) -> Decimal:
    return (ask + bid) / 2


def implied_side_fee(ask: Decimal, bid: Decimal) -> Decimal:
    return (ask - bid) / (ask + bid)
