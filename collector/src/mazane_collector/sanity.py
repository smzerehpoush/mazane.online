"""چک میانه‌ی تقاطعی — بند ۴ سند معماری، قاعده‌ی ۳ قراردادها.

پراکندگی واقعی منابع زیر ۰٫۱٪ است؛ هر mid که بیش از ۰٫۵٪ از میانه‌ی *سایر*
منابع تازه فاصله بگیرد تقریباً قطعاً خطای مقیاس یا endpoint خراب است، نه
حرکت بازار ⟸ منتشر نمی‌شود. نتیجه‌ی این محاسبه یک ابزار داخلی تشخیص خطاست
و هرگز به‌عنوان «میانگین بازار» منتشر نمی‌شود (بند ۷.۱).

رأی فقط با `MID` است و بس. سطر `MEAN` (قیمت مرجع سکو) عمداً وارد رأی‌گیری
نمی‌شود: مشتقِ همان MID/BUY/SELL است و آوردنش یعنی شمردن یک منبع دو بار —
میانه را به سمت سکوهای دوسمته کج می‌کند بی‌آنکه اطلاع تازه‌ای بدهد.
"""

from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal

from .models import PlatformSnapshot, Side

MEDIAN_DEVIATION_THRESHOLD = Decimal("0.005")  # ۰٫۵٪
MIN_SOURCES_FOR_CHECK = 3  # با کمتر از ۳ منبع تازه رأی‌گیری ممکن نیست


def _mid_toman(snapshot: PlatformSnapshot) -> Decimal | None:
    for quote in snapshot.quotes:
        if quote.side is Side.MID:
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
    mids = {
        snapshot.platform_slug: mid
        for snapshot in snapshots
        if (mid := _mid_toman(snapshot)) is not None
    }
    if len(mids) < MIN_SOURCES_FOR_CHECK:
        return frozenset()

    outliers: set[str] = set()
    for slug, mid in mids.items():
        others = [value for other, value in mids.items() if other != slug]
        median = _median(others)
        if median == 0:
            continue
        if abs(mid - median) / median > MEDIAN_DEVIATION_THRESHOLD:
            outliers.add(slug)
    return frozenset(outliers)
