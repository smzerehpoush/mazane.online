"""مرز گردآورنده — تنظیمات سکو از پنل (بلیت ۲۱): پستگرس ⟸ چارت‌کانفیگ ⟸ ردیس.

هیچ تماس شبکه‌ای/دیتابیس واقعی‌ای نیست: `FakeSettingsGateway` همان قرارداد
`SettingsGateway` را برمی‌گرداند و `InMemoryStore` جای ردیس را می‌گیرد —
دقیقاً همان مرزی که `test_multi_source_round.py` برای نوبت قیمت می‌سنجد.
"""

from __future__ import annotations

from datetime import UTC, datetime

from tablo_collector.models import DataPolicy, Platform
from tablo_collector.settings import (
    ChartConfigEntry,
    PlatformSettingRow,
    chart_config_from_settings,
    platforms_with_referral_overrides,
)
from tablo_collector.store.memory import InMemoryStore

NOW = datetime(2026, 8, 7, 9, 30, 0, tzinfo=UTC)

WALLGOLD = Platform(slug="wallgold", name_fa="وال‌گلد", data_policy=DataPolicy.ALLOWED)
TALASEA = Platform(slug="talasea", name_fa="طلاسی", data_policy=DataPolicy.ALLOWED)
MILLI = Platform(slug="milli", name_fa="میلی", data_policy=DataPolicy.ALLOWED)
TLYN = Platform(slug="tlyn", name_fa="طلاین", data_policy=DataPolicy.ALLOWED)
GOLDIKA = Platform(slug="goldika", name_fa="گلدیکا", data_policy=DataPolicy.PERMISSION_PENDING)

LISTED = (WALLGOLD, TALASEA, MILLI, TLYN)


def row(
    slug: str,
    *,
    in_chart: bool = True,
    color: str | None = "#1d6fe0",
    order: int | None = 0,
    referral_url: str | None = None,
) -> PlatformSettingRow:
    return PlatformSettingRow(
        slug=slug,
        in_chart=in_chart,
        chart_color=color,
        chart_order=order,
        referral_url=referral_url,
        updated_at=NOW,
    )


class FakeSettingsGateway:
    """فیک `SettingsGateway` — همان قرارداد `PostgresSettingsGateway`."""

    def __init__(self, rows: tuple[PlatformSettingRow, ...]) -> None:
        self._rows = rows

    async def list_platform_settings(self) -> tuple[PlatformSettingRow, ...]:
        return self._rows


# ------------------------------------------------ chart_config_from_settings


def test_filters_to_in_chart_rows_only() -> None:
    rows = (
        row("wallgold", in_chart=True, order=0),
        row("talasea", in_chart=False, color=None, order=None),
    )
    config = chart_config_from_settings(rows, LISTED)
    assert {c.slug for c in config} == {"wallgold"}


def test_sorts_by_chart_order() -> None:
    rows = (
        row("milli", order=2),
        row("wallgold", order=0),
        row("talasea", order=1),
    )
    config = chart_config_from_settings(rows, LISTED)
    assert [c.slug for c in config] == ["wallgold", "talasea", "milli"]
    # ترتیب خروجی رتبه‌ی صفرمبنای نهایی است، نه chart_order خام.
    assert [c.order for c in config] == [0, 1, 2]


def test_null_order_goes_last_then_by_slug() -> None:
    rows = (
        row("milli", order=None),
        row("wallgold", order=0),
        row("talasea", order=None),
    )
    config = chart_config_from_settings(rows, LISTED)
    # milli و talasea هر دو order=None اند ⟸ بعد از wallgold، به ترتیب اسلاگ.
    assert [c.slug for c in config] == ["wallgold", "milli", "talasea"]


def test_malformed_color_is_dropped() -> None:
    """رنگ بدشکل — دفاع دوم، حتی اگر رنگ نامعتبر از راهی دیگر در جدول نشست."""
    rows = (
        row("wallgold", color="not-a-color"),
        row("talasea", color="#1D6FE0"),  # حروف بزرگ هم معتبر است
        row("milli", color=None),
    )
    config = chart_config_from_settings(rows, LISTED)
    assert [c.slug for c in config] == ["talasea"]
    # رنگ ذخیره‌شده همیشه lower است.
    assert config[0].color == "#1d6fe0"


def test_unlisted_or_unknown_slug_is_dropped() -> None:
    """اسلاگ ناشناخته/غیرقابل‌نمایش (گلدیکا: PERMISSION_PENDING) قابل افزودن نیست."""
    rows = (
        row("wallgold"),
        row("goldika"),  # در LISTED نیست
        row("no-such-platform"),
    )
    config = chart_config_from_settings(rows, LISTED)
    assert [c.slug for c in config] == ["wallgold"]


def test_name_fa_comes_from_listed_platform_registry() -> None:
    rows = (row("talasea"),)
    config = chart_config_from_settings(rows, LISTED)
    assert config[0].name_fa == "طلاسی"


def test_more_than_six_or_fewer_than_two_is_not_gated_here() -> None:
    """شمار (بین ۲ تا ۶) دروازه‌ی نوشتن پنل است، نه این تابع — همه‌ی ردیف‌های
    معتبر منتقل می‌شوند و فرود امن سمت وب اجرا می‌شود (بند ۵ طراحی تیکت ۲۱)."""
    rows = (row("wallgold", order=0),)
    config = chart_config_from_settings(rows, LISTED)
    assert len(config) == 1


# ------------------------------------------------ یک «دور» گردآورنده کامل


async def test_settings_sync_round_writes_ordered_config_to_store() -> None:
    """همان چیزی که `main.py::settings_sync_loop` هر نوبت انجام می‌دهد:
    خواندن گیت‌وی ⟸ ساخت پیکربندی ⟸ نوشتن در استور — و پس از یک دور، نمودار
    (از `store.get_chart_config`) همان تنظیمات را می‌بیند."""
    gateway = FakeSettingsGateway(
        (
            row("talasea", order=1, color="#9b8ce8"),
            row("wallgold", order=0, color="#e0921d"),
            row("milli", in_chart=False, color=None, order=None),
        )
    )
    store = InMemoryStore()

    # همان بدنه‌ی حلقه، بدون asyncio.sleep — یک نوبت دستی.
    settings_rows = await gateway.list_platform_settings()
    config = chart_config_from_settings(settings_rows, LISTED)
    await store.save_chart_config(config)

    saved = await store.get_chart_config()
    assert [c.slug for c in saved] == ["wallgold", "talasea"]
    assert saved[0].color == "#e0921d"
    assert isinstance(saved[0], ChartConfigEntry)


async def test_store_get_chart_config_is_empty_before_any_write() -> None:
    """نبودِ تنظیمات ⟸ تهی، نه خطا — وب در این حالت به پیش‌فرض کد برمی‌گردد."""
    store = InMemoryStore()
    assert await store.get_chart_config() == ()


# ------------------------------------------------ platforms_with_referral_overrides (بلیت ۲۳)


def test_referral_override_replaces_registry_value() -> None:
    rows = (row("wallgold", referral_url="https://wallgold.ir/r/mzn"),)
    merged = platforms_with_referral_overrides(rows, LISTED)
    by_slug = {p.slug: p for p in merged}
    assert by_slug["wallgold"].referral_url == "https://wallgold.ir/r/mzn"
    # بقیه دست‌نخورده می‌مانند — همان شیء رجیستری.
    assert by_slug["talasea"] is TALASEA


def test_referral_override_ignores_empty_or_missing_rows() -> None:
    """`referral_url=None` (هنوز ذخیره نشده) یا `""` (پاک‌شده) ⟸ بدون override
    — یعنی رجیستری همان‌طور که هست عبور می‌کند (فرود امن به website_url در وب)."""
    rows = (row("wallgold", referral_url=None), row("talasea", referral_url=""))
    merged = platforms_with_referral_overrides(rows, LISTED)
    assert merged == LISTED


def test_referral_override_ignores_unknown_slug() -> None:
    rows = (row("no-such-platform", referral_url="https://evil.example/x"),)
    merged = platforms_with_referral_overrides(rows, LISTED)
    assert merged == LISTED


def test_referral_override_preserves_registry_order() -> None:
    rows = (row("milli", referral_url="https://milli.gold/r/mzn"),)
    merged = platforms_with_referral_overrides(rows, LISTED)
    assert [p.slug for p in merged] == [p.slug for p in LISTED]


def test_referral_override_applies_regardless_of_listing_status() -> None:
    """`is_listed` فیلتر نمایش عمومی است، نه شرط override — merge روی کل
    رجیستری اجرا می‌شود؛ فیلتر نمایش خودش در `save_platforms`/`is_listed`
    اعمال می‌شود، نه اینجا."""
    full_registry = LISTED + (GOLDIKA,)
    rows = (row("goldika", referral_url="https://goldika.example/r/x"),)
    merged = platforms_with_referral_overrides(rows, full_registry)
    goldika = next(p for p in merged if p.slug == "goldika")
    assert goldika.referral_url == "https://goldika.example/r/x"


async def test_referral_override_reaches_listed_platforms_via_save_platforms() -> None:
    """مسیر کامل بلیت ۲۳: تنظیمات پنل ⟸ merge با رجیستری ⟸ همان مسیر
    `save_platforms` که `platform_loop` هر نوبت صدا می‌زند ⟸ `tablo:listed`
    (اینجا: `store.get_listed_platforms`) — بدون کلید ردیس تازه، و بدون
    اثر روی سکوهایی که override ندارند."""
    gateway = FakeSettingsGateway(
        (row("wallgold", referral_url="https://wallgold.ir/r/mzn-secret"),)
    )
    store = InMemoryStore()

    # همان بدنه‌ی settings_sync_loop، بدون asyncio.sleep — یک نوبت دستی.
    settings_rows = await gateway.list_platform_settings()
    merged = platforms_with_referral_overrides(settings_rows, LISTED)
    # همان بدنه‌ی platform_loop (collect_round) که این فهرست merge‌شده را
    # به store.save_platforms می‌دهد.
    await store.save_platforms(merged)

    listed = await store.get_listed_platforms()
    wallgold = next(p for p in listed if p.slug == "wallgold")
    assert wallgold.referral_url == "https://wallgold.ir/r/mzn-secret"
    talasea = next(p for p in listed if p.slug == "talasea")
    assert talasea.referral_url is None
