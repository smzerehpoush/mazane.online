"""جدول مرکزی اسلاگ — مالک همه‌ی اسلاگ‌های عمومی سایت (بند ۱۳، تصمیم ۱۱).

طرح URL تخت است: ‎/wallgold‎ و ‎/tala-18‎ و ‎/darbare-pishnahad‎ همه در یک
فضای نام زندگی می‌کنند ⟸ برخورد اسلاگ یعنی یک صفحه صفحه‌ی دیگر را می‌خورَد.
مهار ریسک همان تصمیم ۱۱ است: **یک** جدول مرکزی با قید یکتایی بین سکوها،
دارایی‌ها، صفحات ایستا و پست‌های بلاگ + فهرست کلمات رزرو.

پست‌های بلاگ زیر ‎/blog/‎ می‌نشینند ولی تصمیم ۱۱ صریحاً یکتایی را «بین
دارایی‌ها، پلتفرم‌ها و پست‌ها» می‌خواهد — پس ناشر بلاگ (بلیت ۱۳) قبل از
انتشار `validate_new_slug` همین ماژول را صدا می‌زند و خود فضای نام `blog`
کلمه‌ی رزرو است.

رجیستری واقعی (`PUBLIC_SLUGS`) در import ساخته می‌شود: برخورد در کد یعنی
خطای import، نه صفحه‌ی خورده‌شده در production.
"""

from __future__ import annotations

import re
from enum import StrEnum

from .instruments import INSTRUMENTS
from .platforms import PLATFORMS

#: کلمات رزرو تصمیم ۱۱ — مسیرهای زیرساختی که هرگز اسلاگ نمی‌شوند.
RESERVED_WORDS = frozenset(
    {"blog", "go", "api", "sitemap.xml", "robots.txt", "_next", "about"}
)

#: صفحات ایستای سطح ریشه — هر صفحه‌ی جدید باید اینجا ثبت شود.
STATIC_PAGE_SLUGS: tuple[str, ...] = ("darbare-pishnahad",)

# لاتین تخت: حرف کوچک/رقم با خط تیره‌ی میانی — نه نیم‌فاصله، نه «/»، نه «_»
# (بند ۶.۶ سند معماری: اسلاگ فارسی URL نامرئی و تایپ‌ناپذیر می‌سازد).
_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class SlugKind(StrEnum):
    PLATFORM = "platform"
    INSTRUMENT = "instrument"
    STATIC_PAGE = "static_page"
    BLOG_POST = "blog_post"


class SlugError(ValueError):
    """پایه‌ی خطاهای جدول اسلاگ — رد یعنی استثنا، نه هشدار."""


class InvalidSlugError(SlugError):
    """قالب اسلاگ لاتین تخت نیست."""


class ReservedSlugError(SlugError):
    """اسلاگ کلمه‌ی رزرو است."""


class SlugCollisionError(SlugError):
    """اسلاگ قبلاً به موجودیت دیگری داده شده — قید یکتایی."""


class SlugRegistry:
    """قید یکتایی + کلمات رزرو، در یک جا. نمونه‌ی واقعی: `PUBLIC_SLUGS`."""

    def __init__(self) -> None:
        self._slugs: dict[str, SlugKind] = {}

    def register(self, slug: str, kind: SlugKind) -> None:
        self.validate_new_slug(slug)
        self._slugs[slug] = kind

    def validate_new_slug(self, slug: str) -> None:
        """رد برخورد/رزرو/قالب — دروازه‌ی ناشر بلاگ و هر اسلاگ آینده.

        چیزی ثبت نمی‌کند؛ فقط اگر اسلاگ مجاز نباشد استثنای مشخص می‌دهد.
        """
        # رزرو قبل از قالب: «sitemap.xml» و «_next» قالب اسلاگ هم ندارند ولی
        # دلیل ردشان رزرو بودن است — خطای صریح‌تر مقدم است.
        if slug in RESERVED_WORDS:
            raise ReservedSlugError(f"اسلاگ {slug!r} کلمه‌ی رزرو است (تصمیم ۱۱)")
        if not _SLUG_PATTERN.fullmatch(slug):
            raise InvalidSlugError(
                f"اسلاگ {slug!r} لاتین تخت نیست (فقط a-z0-9 و خط تیره — بند ۶.۶)"
            )
        if slug in self._slugs:
            raise SlugCollisionError(
                f"اسلاگ {slug!r} قبلاً به {self._slugs[slug].value} داده شده — قید یکتایی"
            )

    def kind_of(self, slug: str) -> SlugKind | None:
        return self._slugs.get(slug)

    def __contains__(self, slug: str) -> bool:
        return slug in self._slugs


def build_registry() -> SlugRegistry:
    """رجیستری کامل از روی کد: سکوها + دارایی‌ها + صفحات ایستا.

    هر برخوردی همین‌جا استثنا می‌شود؛ تست مرز گردآورنده همین تابع را
    صدا می‌زند تا اضافه شدن اسلاگ تکراری در آینده CI را قرمز کند.
    """
    registry = SlugRegistry()
    for platform in PLATFORMS:
        registry.register(platform.slug, SlugKind.PLATFORM)
    for info in INSTRUMENTS:
        registry.register(info.slug, SlugKind.INSTRUMENT)
    for slug in STATIC_PAGE_SLUGS:
        registry.register(slug, SlugKind.STATIC_PAGE)
    return registry


#: جدول اسلاگ زنده — برخورد در کد = خطای import، نه باگ در production.
PUBLIC_SLUGS = build_registry()
