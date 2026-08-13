from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal

from .models import PlatformSnapshot, Side

MEDIAN_DEVIATION_THRESHOLD = Decimal("0.005")
MIN_SOURCES_FOR_CHECK = 3


def _price_toman(snapshot: PlatformSnapshot) -> Decimal | None:
    for quote in snapshot.quotes:
        if quote.side is Side.PRICE:
            return Decimal(quote.price_toman)
    return None


def _median(values: Sequence[Decimal]) -> Decimal:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def median_outliers(snapshots: Sequence[PlatformSnapshot]) -> frozenset[str]:
    prices = {
        snapshot.platform_slug: price
        for snapshot in snapshots
        if (price := _price_toman(snapshot)) is not None
    }
    if len(prices) < MIN_SOURCES_FOR_CHECK:
        return frozenset()

    outliers: set[str] = set()
    for slug, price in prices.items():
        others = [value for other, value in prices.items() if other != slug]
        median = _median(others)
        if median == 0:
            continue
        if abs(price - median) / median > MEDIAN_DEVIATION_THRESHOLD:
            outliers.add(slug)
    return frozenset(outliers)
