"""نوبت گردآوری مراجع — جدا از نوبت سکوها، عمداً.

**مرجع در رأی چک میانه شرکت نمی‌کند — تصمیم مستند این بلیت.** چک میانه‌ی
بند ۴ روی mid سکوهاست و «سازگاری بدیهی» شرط ورود هر ورودی کمکی است؛ سند
تحقیق ۰۱ (بند ۳.۷) نشان داد مراجع بازار به‌طور سیستماتیک **~۰٫۵٪ بالاتر**
از میانه‌ی سکوها می‌ایستند — یعنی دقیقاً لب آستانه‌ی ۰٫۵٪ و با سوگیری
یک‌طرفه. چنین ورودی‌ای بدیهی‌سازگار نیست: میانه را جابه‌جا می‌کند و می‌تواند
سکوی سالم را سرکوب کند. پس مراجع **به‌کلی بیرون از رأی** می‌مانند و این
جدایی ساختاری است: این تابع فقط `ReferenceSnapshot` می‌سازد که اصلاً به
`median_outliers` (که `PlatformSnapshot` می‌گیرد) راه ندارد.

شکست هر مرجع ⟸ کهنگی همان مرجع + لاگ؛ نوبت ادامه می‌یابد (قاعده‌ی ۵).
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Protocol

from ..store import Store
from . import ReferenceSnapshot
from .talair import TalairReference
from .transport import ReferenceTransport

log = logging.getLogger("mazane.collector.references")


class ReferenceSource(Protocol):
    """هر مرجع: یک اسلاگ و یک گردآوری کامل (fetch + parse) روی ترابرد تزریقی."""

    slug: str

    async def collect(
        self, transport: ReferenceTransport, fetched_at: datetime
    ) -> ReferenceSnapshot: ...


# تنها مرجع فعال (بند ۱۲.۲؛ سند تصمیم ۰۰۰۲) — و در PLATFORMS نیست.
# بن‌بست حذف شد: جمع‌آوری می‌شد و هیچ‌جای سایت دیده نمی‌شد، و هر نوبت یک
# fetch دومرحله‌ای با استخراج توکن گردان از HTML لازم داشت.
REFERENCE_SOURCES: tuple[ReferenceSource, ...] = (TalairReference(),)


async def collect_reference_round(
    sources: Sequence[ReferenceSource],
    transport: ReferenceTransport,
    store: Store,
    *,
    now: datetime | None = None,
) -> tuple[ReferenceSnapshot, ...]:
    """یک نوبت گردآوری مراجع؛ خروجی فقط در تاریخچه + کلید جاری مرجع می‌نشیند.

    هرگز چیزی به فهرست عمومی سکوها یا رأی میانه اضافه نمی‌کند (docstring ماژول).
    """
    fetched_at = now if now is not None else datetime.now(UTC)

    saved: list[ReferenceSnapshot] = []
    for source in sources:
        try:
            snapshot = await source.collect(transport, fetched_at)
        except Exception:
            # کهنگی، نه خطا: آخرین اسنپ‌شات مرجع می‌ماند و نوبت ادامه دارد.
            log.exception("گردآوری مرجع %s شکست خورد — مرجع کهنه می‌ماند", source.slug)
            continue
        await store.save_reference(snapshot)
        saved.append(snapshot)
    return tuple(saved)
