import json

from tablo_collector.models import DataPolicy, Platform
from tablo_collector.platforms import PLATFORMS
from tablo_collector.store.memory import InMemoryStore
from tablo_collector.store.redis_store import LISTED_KEY, RedisStore

DOCUMENTED_PARAMS = {
    "milli": "referralCode",
    "talasea": "r",
    "technogold": "referralCode",
}


class FakeRedis:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.data[key] = value

    async def get(self, key: str) -> str | None:
        return self.data.get(key)


def test_platform_model_defaults_referral_fields_to_none() -> None:
    platform = Platform(slug="x", name_fa="ایکس", data_policy=DataPolicy.ALLOWED)
    assert platform.referral_url is None
    assert platform.referral_param is None


def test_registry_has_no_referral_url_yet() -> None:
    assert all(platform.referral_url is None for platform in PLATFORMS)


def test_registry_records_only_documented_referral_params() -> None:
    by_slug = {platform.slug: platform for platform in PLATFORMS}
    for slug, param in DOCUMENTED_PARAMS.items():
        assert by_slug[slug].referral_param == param
    for platform in PLATFORMS:
        if platform.slug not in DOCUMENTED_PARAMS:
            assert platform.referral_param is None


async def test_listed_payload_carries_referral_fields_in_redis() -> None:
    client = FakeRedis()
    store = RedisStore(client)

    await store.save_platforms(PLATFORMS)

    listed = json.loads(client.data[LISTED_KEY])
    assert len(listed) > 0
    for item in listed:
        assert "referral_url" in item
        assert "referral_param" in item
        assert item["referral_url"] is None
        expected = DOCUMENTED_PARAMS.get(item["slug"])
        assert item["referral_param"] == expected


async def test_memory_store_round_trips_referral_fields() -> None:
    store = InMemoryStore()
    await store.save_platforms(PLATFORMS)

    listed = await store.get_listed_platforms()
    by_slug = {platform.slug: platform for platform in listed}
    assert by_slug["milli"].referral_param == "referralCode"
    assert by_slug["talasea"].referral_param == "r"
    assert by_slug["wallgold"].referral_param is None
    assert all(platform.referral_url is None for platform in listed)


def test_platform_from_listed_row_merges_registry_metadata() -> None:
    from tablo_collector.store.postgres_store import platform_from_listed_row

    row = {"slug": "milli", "name_fa": "میلی", "data_policy": "ALLOWED", "market_model": "OTC"}
    platform = platform_from_listed_row(row)
    assert platform.delivery_note_fa is not None
    assert platform.website_url == "https://milli.gold"

    unknown = {
        "slug": "ghost",
        "name_fa": "شبح",
        "data_policy": "ALLOWED",
        "market_model": "OTC",
    }
    fallback = platform_from_listed_row(unknown)
    assert fallback.slug == "ghost"
    assert fallback.delivery_note_fa is None
