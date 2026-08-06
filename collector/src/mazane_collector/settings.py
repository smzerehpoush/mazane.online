"""تنظیمات سکو از پنل مدیریت (بلیت ۲۱ + بلیت ۲۳): عضویت نمودار/رنگ/ترتیب و
لینک معرف.

پنل فقط پستگرس (جدول `platform_settings` — مهاجرت `015_platform_settings.sql`)
را می‌نویسد؛ هرگز مستقیم به ردیس. گردآورنده این ماژول را هر ~۲۰ ثانیه
(`main.py::settings_sync_loop`) صدا می‌زند: کل ردیف‌های `platform_settings`
را می‌خواند (نه فقط ستون‌های چارت — `PlatformSettingRow` کامل است، از جمله
`referral_url`) و دو کار می‌کند: عضویت نمودار را به `Store.save_chart_config`
می‌سپارد، و override نشانی معرف را با `platforms_with_referral_overrides`
روی رجیستری زنده‌ی سکوها می‌نشاند تا از همان مسیر موجود `Store.save_platforms`
⟸ `mazane:listed` ⟸ `/go/<slug>` به وب برسد (بدون کلید ردیس تازه).

`chart_config_from_settings` دروازه‌ی دومِ دفاعی است (اولی نوشتن پنل است):
حتی اگر ردیفی با رنگ بدشکل یا اسلاگ ناشناخته/غیرقابل‌نمایش در جدول نشست
(مثلاً با ویرایش دستی دیتابیس)، اینجا هم رد می‌شود — نمودار هرگز رنگ نامعتبر
یا سکوی غیرمجاز نمی‌بیند. شمار (بین ۲ تا ۶) اینجا اجرا **نمی‌شود**: آن
دروازه سمت نوشتن پنل است (بند ۵ طراحی تیکت ۲۱)؛ اینجا هرچه معتبر است
منتقل می‌شود و فرود امنِ «کمتر از ۲ یا بیش از ۶» در خواننده‌ی وب
(`web/src/lib/server/chart-config-source.ts`) اعمال می‌شود — قطع/بدشکلی
تنظیمات یعنی کهنگی، نه خطا (قاعده‌ی ۳ قراردادها).

`platforms_with_referral_overrides` دروازه‌ی دوم ندارد — طرح/دامنه‌ی نشانی
(https + هم‌دامنه یا زیردامنه‌ی `website_url`) فقط سمت نوشتن پنل سنجیده
می‌شود (`web/src/lib/platform-settings.ts::validateReferralUrls`، پیش از
insert/update)؛ اینجا فقط جایگزینی رشته‌به‌رشته است، به همان اعتماد نوشتن
پنل که `chart_color`/`chart_order` هم به آن تکیه دارند.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict

from .models import Platform

_COLOR_RE = re.compile(r"^#[0-9a-f]{6}$", re.IGNORECASE)


class PlatformSettingRow(BaseModel):
    """یک ردیف کامل `platform_settings` — همان چیزی که پنل ذخیره کرده."""

    model_config = ConfigDict(frozen=True)

    slug: str
    in_chart: bool
    chart_color: str | None
    chart_order: int | None
    # لینک معرف (بلیت ۲۳): تهی یعنی «override ندارد» — رجیستری/website_url
    # همان رفتار امروز می‌ماند. `platforms_with_referral_overrides` مصرفش
    # می‌کند.
    referral_url: str | None
    updated_at: datetime


class ChartConfigEntry(BaseModel):
    """یک سری نمودار — همان چیزی که `Store.save_chart_config` می‌گیرد و
    وب از `mazane:chart_config` می‌خواند (شکلش آینه‌ی `ChartPlatformConfig`
    در `web/src/lib/site-content.ts` است)."""

    model_config = ConfigDict(frozen=True)

    slug: str
    name_fa: str
    color: str
    order: int


class SettingsGateway(Protocol):
    """پستگرس واقعی (`PostgresSettingsGateway`) یا فیک تست."""

    async def list_platform_settings(self) -> tuple[PlatformSettingRow, ...]:
        """همه‌ی ردیف‌های `platform_settings` — کامل، نه فقط ستون‌های چارت."""
        ...


_SELECT_SETTINGS = """
select slug, in_chart, chart_color, chart_order, referral_url, updated_at
from platform_settings
"""


class PostgresSettingsGateway:
    def __init__(self, pool: Any) -> None:
        """`pool` یک `asyncpg.Pool` است (تزریقی، برای تست‌پذیری)."""
        self._pool = pool

    async def list_platform_settings(self) -> tuple[PlatformSettingRow, ...]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(_SELECT_SETTINGS)
        return tuple(
            PlatformSettingRow(
                slug=row["slug"],
                in_chart=row["in_chart"],
                chart_color=row["chart_color"],
                chart_order=row["chart_order"],
                referral_url=row["referral_url"],
                updated_at=row["updated_at"],
            )
            for row in rows
        )


def chart_config_from_settings(
    rows: Sequence[PlatformSettingRow],
    listed_platforms: Sequence[Platform],
) -> tuple[ChartConfigEntry, ...]:
    """ردیف‌های تنظیمات ⟸ سری‌های نمودار مرتب‌شده.

    فیلتر: `in_chart=True`، رنگ با شکل `#rrggbb` (بی‌حساسیت به حروف بزرگ/کوچک
    ولی ذخیره‌شده lower)، و اسلاگ در فهرست سکوهای واقعاً قابل نمایش (بند ۵
    طراحی تیکت ۲۱). مرتب‌سازی بر `chart_order` (`None` انتهای فهرست، بعد
    اسلاگ برای پایداری) — `order` خروجی همان رتبه‌ی صفرمبنای نهایی است.
    """
    listed_by_slug = {p.slug: p for p in listed_platforms}

    def is_eligible(row: PlatformSettingRow) -> bool:
        return (
            row.in_chart
            and row.chart_color is not None
            and _COLOR_RE.match(row.chart_color) is not None
            and row.slug in listed_by_slug
        )

    candidates = [row for row in rows if is_eligible(row)]
    candidates.sort(
        key=lambda row: (
            row.chart_order if row.chart_order is not None else 2**31,
            row.slug,
        )
    )

    entries: list[ChartConfigEntry] = []
    for i, row in enumerate(candidates):
        assert row.chart_color is not None  # تضمین‌شده در is_eligible
        entries.append(
            ChartConfigEntry(
                slug=row.slug,
                name_fa=listed_by_slug[row.slug].name_fa,
                # چون رنگ خودِ پنل هم قرار است lower ذخیره کند، این فقط دفاع دوم است.
                color=row.chart_color.lower(),
                order=i,
            )
        )
    return tuple(entries)


def platforms_with_referral_overrides(
    rows: Sequence[PlatformSettingRow],
    platforms: Sequence[Platform],
) -> tuple[Platform, ...]:
    """رجیستری سکوها + override نشانی معرف پنل (بلیت ۲۳).

    برای هر ردیف با `referral_url` غیرخالی، سکوی هم‌اسلاگ رجیستری با
    `model_copy(update={"referral_url": ...})` جایگزین می‌شود؛ بقیه‌ی سکوها
    همان شیء رجیستری می‌مانند. اسلاگ ناشناخته (در `platform_settings` هست
    ولی در رجیستری نیست) نادیده گرفته می‌شود — رجیستری تنها منبع فهرست سکوهاست.

    خروجی همان ترتیب و همان اعضای ورودی `platforms` است (فقط سکوهای override
    شده جایگزین می‌شوند) — این تابع فیلتر نمایش (`is_listed`) اعمال نمی‌کند؛
    آن مرز جای دیگری است (`Store.save_platforms`/`get_listed_platforms`).
    """
    overrides = {row.slug: row.referral_url for row in rows if row.referral_url}
    if not overrides:
        return tuple(platforms)
    return tuple(
        p.model_copy(update={"referral_url": overrides[p.slug]}) if p.slug in overrides else p
        for p in platforms
    )
