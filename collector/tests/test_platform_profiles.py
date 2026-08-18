from __future__ import annotations

import inspect
import json

from tablo_collector.models import (
    DataPolicy,
    FaqItem,
    KycLevel,
    MobileApp,
    PaymentMethod,
    Platform,
    PlatformProfile,
    PlatformTerms,
)
from tablo_collector.platforms import PLATFORMS
from tablo_collector.settings import PlatformProfileRow, platforms_with_profiles
from tablo_collector.store.memory import InMemoryStore
from tablo_collector.store.redis_store import LISTED_KEY, RedisStore

WALLGOLD = Platform(slug="wallgold", name_fa="وال‌گلد", data_policy=DataPolicy.ALLOWED)
TALASEA = Platform(slug="talasea", name_fa="طلاسی", data_policy=DataPolicy.ALLOWED)
MILLI = Platform(slug="milli", name_fa="میلی", data_policy=DataPolicy.ALLOWED)

LISTED = (WALLGOLD, TALASEA, MILLI)

FILLED = PlatformProfileRow(
    slug="wallgold",
    payment_methods=(PaymentMethod.GATEWAY, PaymentMethod.WALLET),
    kyc_level=KycLevel.BASIC,
    mobile_app=MobileApp.BOTH,
    delivery_cost_fa="هزینه‌ی ارسال شمش بر عهده‌ی خریدار است",
    min_buy_toman=100_000,
    min_sell_toman=50_000,
    pros_fa=("کارمزد پایین",),
    cons_fa=("تحویل فیزیکی محدود",),
    faq=(FaqItem(question_fa="چطور برداشت کنم؟", answer_fa="از بخش کیف پول."),),
)


class FakeRedis:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.data[key] = value

    async def get(self, key: str) -> str | None:
        return self.data.get(key)


def test_registry_never_hard_codes_a_profile() -> None:
    assert all(platform.profile is None for platform in PLATFORMS)


def test_platform_terms_no_longer_carries_the_dead_minimum() -> None:
    assert "min_order_toman" not in PlatformTerms.model_fields


def test_no_adapter_helper_still_offers_a_minimum_argument() -> None:
    from tablo_collector.adapters import common

    for name in ("known_fee_snapshot", "unknown_fee_snapshot", "dealer_snapshot"):
        parameters = inspect.signature(getattr(common, name)).parameters
        assert "min_order_toman" not in parameters


def test_profile_merge_attaches_only_the_matching_slug() -> None:
    merged = platforms_with_profiles((FILLED,), LISTED)
    by_slug = {p.slug: p for p in merged}
    assert by_slug["wallgold"].profile == FILLED.as_profile()
    assert by_slug["talasea"] is TALASEA
    assert by_slug["milli"].profile is None


def test_profile_merge_preserves_registry_order() -> None:
    merged = platforms_with_profiles((FILLED,), LISTED)
    assert [p.slug for p in merged] == [p.slug for p in LISTED]


def test_an_all_empty_row_never_replaces_the_registry_entry() -> None:
    merged = platforms_with_profiles((PlatformProfileRow(slug="wallgold"),), LISTED)
    assert merged == LISTED


def test_profile_merge_ignores_an_unknown_slug() -> None:
    row = PlatformProfileRow(slug="no-such-platform", kyc_level=KycLevel.FULL)
    assert platforms_with_profiles((row,), LISTED) == LISTED


def test_a_registry_value_is_not_lost_when_a_profile_is_attached() -> None:
    registry = (
        Platform(
            slug="talasea",
            name_fa="طلاسی",
            data_policy=DataPolicy.ALLOWED,
            legal_entity="شرکت توسعه راهکار الوند ارسباران",
            founded_year_jalali=1399,
        ),
    )
    merged = platforms_with_profiles((FILLED.model_copy(update={"slug": "talasea"}),), registry)
    assert merged[0].legal_entity == "شرکت توسعه راهکار الوند ارسباران"
    assert merged[0].founded_year_jalali == 1399


async def test_profile_reaches_the_redis_listed_payload() -> None:
    client = FakeRedis()
    store = RedisStore(client)

    await store.save_platforms(platforms_with_profiles((FILLED,), LISTED))

    listed = json.loads(client.data[LISTED_KEY])
    by_slug = {item["slug"]: item for item in listed}
    assert by_slug["wallgold"]["profile"]["payment_methods"] == ["GATEWAY", "WALLET"]
    assert by_slug["wallgold"]["profile"]["min_buy_toman"] == 100_000
    assert by_slug["wallgold"]["profile"]["faq"][0]["question_fa"] == "چطور برداشت کنم؟"
    assert by_slug["talasea"]["profile"] is None
    assert by_slug["wallgold"]["founded_year_jalali"] is None


async def test_memory_store_round_trips_the_profile() -> None:
    store = InMemoryStore()
    await store.save_platforms(platforms_with_profiles((FILLED,), LISTED))

    listed = await store.get_listed_platforms()
    wallgold = next(p for p in listed if p.slug == "wallgold")
    assert wallgold.profile is not None
    assert wallgold.profile.kyc_level is KycLevel.BASIC
    assert wallgold.profile.mobile_app is MobileApp.BOTH


def test_an_untouched_profile_reports_itself_empty() -> None:
    assert PlatformProfile().is_empty
    assert not PlatformProfile(kyc_level=KycLevel.NONE).is_empty
    assert not PlatformProfile(pros_fa=("سریع",)).is_empty
