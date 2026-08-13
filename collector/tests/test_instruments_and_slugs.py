import json
from datetime import UTC, datetime

import pytest

from tablo_collector.instruments import (
    INSTRUMENTS,
    PUBLISH_GATE_MIN_PLATFORMS,
    InstrumentListing,
    build_listings,
)
from tablo_collector.models import Instrument
from tablo_collector.pipeline import collect_round
from tablo_collector.platforms import PLATFORMS
from tablo_collector.slugs import (
    PUBLIC_SLUGS,
    RESERVED_WORDS,
    STATIC_PAGE_SLUGS,
    InvalidSlugError,
    ReservedSlugError,
    SlugCollisionError,
    SlugKind,
    SlugRegistry,
    build_registry,
)
from tablo_collector.store.memory import InMemoryStore

from test_full_roster_round import (
    ALL_ADAPTERS,
    KNOWN_FEE_LISTED,
    UNKNOWN_FEE_LISTED,
    make_fetcher,
)

FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


async def test_round_publishes_instruments_payload_with_gate_status() -> None:
    store = InMemoryStore()
    await collect_round(
        ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT
    )

    listings = {item.instrument: item for item in await store.get_instruments()}
    assert set(listings) == {info.instrument for info in INSTRUMENTS}

    gold = listings[Instrument.GOLD_18K]
    assert gold.slug == "tala-18"
    assert gold.name_fa == "طلای ۱۸ عیار"
    assert gold.unit_fa == "گرم"
    assert gold.purity == "750"
    assert gold.supporting_platform_slugs == KNOWN_FEE_LISTED + UNKNOWN_FEE_LISTED
    assert "goldika" not in gold.supporting_platform_slugs
    assert gold.published is True

    for instrument in (Instrument.ABSHODE_MITHQAL, Instrument.SILVER_990, Instrument.XAU):
        assert listings[instrument].supporting_platform_slugs == ()
        assert listings[instrument].published is False


def test_publish_gate_requires_at_least_two_listed_platforms() -> None:
    assert PUBLISH_GATE_MIN_PLATFORMS == 2
    by_slug = {adapter.slug: adapter for adapter in ALL_ADAPTERS}

    def gold(listings: tuple[InstrumentListing, ...]) -> InstrumentListing:
        return next(item for item in listings if item.instrument is Instrument.GOLD_18K)

    single = gold(build_listings([by_slug["wallgold"]], PLATFORMS))
    assert single.supporting_platform_slugs == ("wallgold",)
    assert single.published is False

    with_goldika = gold(build_listings([by_slug["wallgold"], by_slug["goldika"]], PLATFORMS))
    assert with_goldika.supporting_platform_slugs == ("wallgold",)
    assert with_goldika.published is False

    two = gold(build_listings([by_slug["wallgold"], by_slug["talasea"]], PLATFORMS))
    assert two.supporting_platform_slugs == ("wallgold", "talasea")
    assert two.published is True


async def test_instruments_payload_shape_is_web_contract() -> None:
    store = InMemoryStore()
    await collect_round(
        ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT
    )
    for listing in await store.get_instruments():
        payload = listing.model_dump(mode="json")
        assert set(payload) == {
            "slug",
            "instrument",
            "name_fa",
            "unit_fa",
            "purity",
            "currency",
            "supporting_platform_slugs",
            "published",
        }
        assert isinstance(payload["published"], bool)


def test_real_registry_has_all_public_slugs_and_no_collisions() -> None:
    registry = build_registry()
    for platform in PLATFORMS:
        assert registry.kind_of(platform.slug) is SlugKind.PLATFORM
    for info in INSTRUMENTS:
        assert registry.kind_of(info.slug) is SlugKind.INSTRUMENT
    for slug in STATIC_PAGE_SLUGS:
        assert registry.kind_of(slug) is SlugKind.STATIC_PAGE
    for word in RESERVED_WORDS:
        assert registry.kind_of(word) is None


def test_duplicate_slug_is_rejected() -> None:
    registry = SlugRegistry()
    registry.register("tala-18", SlugKind.INSTRUMENT)
    with pytest.raises(SlugCollisionError):
        registry.register("tala-18", SlugKind.PLATFORM)


def test_reserved_words_are_rejected() -> None:
    assert RESERVED_WORDS == {
        "blog",
        "go",
        "api",
        "sitemap.xml",
        "robots.txt",
        "_next",
        "about",
    }
    registry = SlugRegistry()
    for word in RESERVED_WORDS:
        with pytest.raises(ReservedSlugError):
            registry.register(word, SlugKind.BLOG_POST)


def test_validate_new_slug_is_the_blog_publishers_gate() -> None:
    PUBLIC_SLUGS.validate_new_slug("moghayese-karmozd-sakooha")
    with pytest.raises(SlugCollisionError):
        PUBLIC_SLUGS.validate_new_slug("wallgold")
    with pytest.raises(SlugCollisionError):
        PUBLIC_SLUGS.validate_new_slug("tala-18")
    with pytest.raises(ReservedSlugError):
        PUBLIC_SLUGS.validate_new_slug("blog")
    with pytest.raises(InvalidSlugError):
        PUBLIC_SLUGS.validate_new_slug("طلا-۱۸")
    with pytest.raises(InvalidSlugError):
        PUBLIC_SLUGS.validate_new_slug("Tala-18")
