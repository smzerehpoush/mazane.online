"""چک میانه‌ی تقاطعی — بند ۴ سند معماری، قاعده‌ی ۳ قراردادها.

پراکندگی واقعی منابع زیر ۰٫۱٪ است؛ هر mid که بیش از ۰٫۵٪ از میانه‌ی *سایر*
منابع تازه فاصله بگیرد تقریباً قطعاً خطای مقیاس یا endpoint خراب است، نه
حرکت بازار ⟸ منتشر نمی‌شود. نتیجه‌ی این محاسبه یک ابزار داخلی تشخیص خطاست
و هرگز به‌عنوان «میانگین بازار» منتشر نمی‌شود (بند ۷.۱).

رأی با «قیمت» هر سکو گرفته می‌شود — تنها عددی که هر سکو دارد. از وقتی قیمت
مؤثر حذف شد (سند تصمیم ۰۰۰۲) دیگر خطر شمردن یک منبع دو بار وجود ندارد:
هر سکو دقیقاً یک رأی می‌دهد.

سکویی که آن نوبت قیمت ندارد (دفتر سفارشِ یک‌سمته) اصلاً اسنپ‌شات نمی‌سازد و
خودبه‌خود از رأی‌گیری بیرون است.
"""

from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal

from .models import PlatformSnapshot, Side

MEDIAN_DEVIATION_THRESHOLD = Decimal("0.005")  # ۰٫۵٪
MIN_SOURCES_FOR_CHECK = 3  # با کمتر از ۳ منبع تازه رأی‌گیری ممکن نیست


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
    """اسلاگ منابعی که از میانه‌ی سایر منابع تازه بیش از آستانه فاصله دارند."""
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
