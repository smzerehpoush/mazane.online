from __future__ import annotations

import re
from enum import StrEnum

from .instruments import INSTRUMENTS
from .platforms import PLATFORMS

RESERVED_WORDS = frozenset(
    {"blog", "go", "api", "sitemap.xml", "robots.txt", "_next", "about"}
)

STATIC_PAGE_SLUGS: tuple[str, ...] = ("darbare-pishnahad",)

_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class SlugKind(StrEnum):
    PLATFORM = "platform"
    INSTRUMENT = "instrument"
    STATIC_PAGE = "static_page"
    BLOG_POST = "blog_post"


class SlugError(ValueError):
    pass


class InvalidSlugError(SlugError):
    pass


class ReservedSlugError(SlugError):
    pass


class SlugCollisionError(SlugError):
    pass


class SlugRegistry:

    def __init__(self) -> None:
        self._slugs: dict[str, SlugKind] = {}

    def register(self, slug: str, kind: SlugKind) -> None:
        self.validate_new_slug(slug)
        self._slugs[slug] = kind

    def validate_new_slug(self, slug: str) -> None:
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
    registry = SlugRegistry()
    for platform in PLATFORMS:
        registry.register(platform.slug, SlugKind.PLATFORM)
    for info in INSTRUMENTS:
        registry.register(info.slug, SlugKind.INSTRUMENT)
    for slug in STATIC_PAGE_SLUGS:
        registry.register(slug, SlugKind.STATIC_PAGE)
    return registry


PUBLIC_SLUGS = build_registry()
