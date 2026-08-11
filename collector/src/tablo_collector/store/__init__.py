"""لایه‌ی ذخیره — اینترفیس کوچک، پیاده‌سازی‌های عمیق.

قرارداد: اسنپ‌شات جاری هر سکو + شرایط سکو + `updated_at` هر منبع +
فهرست عمومی سکوها + اسنپ‌شات جاری مراجع قیمت. تست‌ها فیک درون‌حافظه‌ای همین
اینترفیس را می‌گیرند و به هیچ سرویس زنده‌ای وابسته نیستند. پیاده‌سازی‌های
واقعی: ردیس (قیمت جاری) و پستگرس (تاریخچه).

سه قاعده‌ی مشترک همه‌ی پیاده‌سازی‌ها:
- اسنپ‌شات `suppressed` (رد چک میانه) **هرگز** به قیمت جاری/`updated_at`
  نمی‌رسد؛ فقط در تاریخچه با همان پرچم می‌ماند.
- فهرست عمومی فقط سکوهای `is_listed` را دارد — لایه‌ی وب هیچ فیلتری ندارد،
  چون داده‌ای که می‌خواند از اینجا از قبل فیلترشده است.
- مرجع قیمت (بند ۱۲.۲) کلید جدای خودش را دارد (`tablo:reference:{slug}`)
  و **هرگز** وارد فهرست عمومی یا کلیدهای سکوها نمی‌شود — سکو نیست.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from ..instruments import InstrumentListing
from ..models import Platform, PlatformSnapshot
from ..references import ReferenceSnapshot
from ..settings import ChartConfigEntry


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

    async def save_platforms(self, platforms: Sequence[Platform]) -> None:
        """فراداده‌ی سکوها؛ فهرست عمومی (فقط ALLOWED ها) از همین داده مشتق می‌شود."""
        ...

    async def get_listed_platforms(self) -> tuple[Platform, ...]:
        """سکوهای قابل نمایش عمومی — `PERMISSION_PENDING` (گلدیکا) هرگز برنمی‌گردد."""
        ...

    async def save_reference(self, snapshot: ReferenceSnapshot) -> None:
        """اسنپ‌شات مرجع قیمت — تاریخچه + کلید جاری خودش، هرگز فهرست عمومی."""
        ...

    async def get_reference(self, reference_slug: str) -> ReferenceSnapshot | None:
        """آخرین اسنپ‌شات جاری مرجع، یا None — همیشه با ذکر منبع داخل داده."""
        ...

    async def save_instruments(self, listings: Sequence[InstrumentListing]) -> None:
        """payload دارایی‌ها (بلیت ۷): اسلاگ، نام، واحد، سکوهای پشتیبان و
        **وضعیت دروازه‌ی انتشار** — محاسبه‌شده در گردآورنده؛ وب فقط می‌خواند."""
        ...

    async def get_instruments(self) -> tuple[InstrumentListing, ...]:
        """فهرست دارایی‌ها همان‌طور که ذخیره شده — شامل published=False ها؛
        قاعده‌ی نمایش (404 برای دروازه‌ی رد) با لایه‌ی وب است ولی پرچمش اینجاست."""
        ...

    async def save_chart_config(self, entries: Sequence[ChartConfigEntry]) -> None:
        """سری‌های نمودار صفحه‌ی اصلی (بلیت ۲۱) — همگام‌شده از تنظیمات پنل
        (`platform_settings` در پستگرس) به‌وسیله‌ی `settings_sync_loop`.
        فراداده است نه قیمت: بدون TTL، مثل `tablo:listed`."""
        ...

    async def get_chart_config(self) -> tuple[ChartConfigEntry, ...]:
        """آخرین سری‌های نمودار همگام‌شده — تهی یعنی «هنوز تنظیم نشده»،
        نه خطا؛ وب در این حالت به فهرست پیش‌فرض کد برمی‌گردد."""
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

    async def save_platforms(self, platforms: Sequence[Platform]) -> None:
        for store in self._stores:
            await store.save_platforms(platforms)

    async def get_listed_platforms(self) -> tuple[Platform, ...]:
        return await self._stores[0].get_listed_platforms()

    async def save_reference(self, snapshot: ReferenceSnapshot) -> None:
        for store in self._stores:
            await store.save_reference(snapshot)

    async def get_reference(self, reference_slug: str) -> ReferenceSnapshot | None:
        return await self._stores[0].get_reference(reference_slug)

    async def save_instruments(self, listings: Sequence[InstrumentListing]) -> None:
        for store in self._stores:
            await store.save_instruments(listings)

    async def get_instruments(self) -> tuple[InstrumentListing, ...]:
        return await self._stores[0].get_instruments()

    async def save_chart_config(self, entries: Sequence[ChartConfigEntry]) -> None:
        for store in self._stores:
            await store.save_chart_config(entries)

    async def get_chart_config(self) -> tuple[ChartConfigEntry, ...]:
        return await self._stores[0].get_chart_config()
