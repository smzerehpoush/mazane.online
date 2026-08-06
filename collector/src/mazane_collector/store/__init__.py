"""لایه‌ی ذخیره — اینترفیس کوچک، پیاده‌سازی‌های عمیق.

قرارداد: اسنپ‌شات جاری هر سکو + شرایط سکو + `updated_at` هر منبع.
تست‌ها فیک درون‌حافظه‌ای همین اینترفیس را می‌گیرند و به هیچ سرویس زنده‌ای
وابسته نیستند. پیاده‌سازی‌های واقعی: ردیس (قیمت جاری) و پستگرس (تاریخچه).
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from ..models import PlatformSnapshot


class Store(Protocol):
    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        """اسنپ‌شات کامل یک نوبت گردآوری موفق را می‌نویسد (قیمت‌ها + شرایط + زمان)."""
        ...

    async def get_snapshot(self, platform_slug: str) -> PlatformSnapshot | None:
        """آخرین اسنپ‌شات جاری سکو، یا None اگر چیزی موجود/معتبر نیست."""
        ...

    async def get_updated_at(self, platform_slug: str) -> datetime | None:
        """زمان آخرین گردآوری موفق — جدا از قیمت و بدون انقضا (کهنگی، نه خطا)."""
        ...


class MultiStore:
    """یک نوشتن، چند مقصد (ردیس + پستگرس). خواندن از مقصد اول."""

    def __init__(self, primary: Store, *others: Store) -> None:
        self._stores: tuple[Store, ...] = (primary, *others)

    async def save_snapshot(self, snapshot: PlatformSnapshot) -> None:
        for store in self._stores:
            await store.save_snapshot(snapshot)

    async def get_snapshot(self, platform_slug: str) -> PlatformSnapshot | None:
        return await self._stores[0].get_snapshot(platform_slug)

    async def get_updated_at(self, platform_slug: str) -> datetime | None:
        return await self._stores[0].get_updated_at(platform_slug)
