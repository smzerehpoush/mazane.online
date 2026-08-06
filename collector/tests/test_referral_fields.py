"""مرز گردآورنده — بلیت ۹ (بند ۱۳، تصمیم ۲۱): فیلدهای معرف سکو.

قرارداد: `referral_url` امروز برای همه None است (کدهای معرف را صاحب
کسب‌وکار بعداً می‌دهد ⟸ ‎/go/‎ فعلاً به website_url می‌رود) و
`referral_param` فقط الگوی مستند سند تحقیق ۰۱ بند ۶.۲ را ثبت می‌کند —
پارامترِ بی‌کد. هر دو باید در payload فهرست عمومی (`mazane:listed`، همان
که وب می‌خواند) سریال شوند.
"""

import json

from mazane_collector.models import DataPolicy, Platform
from mazane_collector.platforms import PLATFORMS
from mazane_collector.store.memory import InMemoryStore
from mazane_collector.store.redis_store import LISTED_KEY, RedisStore

# سند تحقیق ۰۱، بند ۶.۲ — تنها الگوهای مستند؛ بقیه None (حدس ممنوع).
DOCUMENTED_PARAMS = {
    "milli": "referralCode",
    "talasea": "r",
    "technogold": "referralCode",
}


class FakeRedis:
    """کمینه‌ی ‎redis.asyncio.Redis‎ که RedisStore لازم دارد — فقط set/get."""

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
    """کد معرف هنوز از صاحب کسب‌وکار نیامده — همه None؛ لینک مستقیم می‌رود."""
    assert all(platform.referral_url is None for platform in PLATFORMS)


def test_registry_records_only_documented_referral_params() -> None:
    """الگوی پارامتر فقط جایی که سند تحقیق ۰۱ (بند ۶.۲) مستندش کرده؛ گلدیکا
    اصلاً پارامتر ندارد و بقیه نامستندند ⟸ None."""
    by_slug = {platform.slug: platform for platform in PLATFORMS}
    for slug, param in DOCUMENTED_PARAMS.items():
        assert by_slug[slug].referral_param == param
    for platform in PLATFORMS:
        if platform.slug not in DOCUMENTED_PARAMS:
            assert platform.referral_param is None


async def test_listed_payload_carries_referral_fields_in_redis() -> None:
    """payload ‏`mazane:listed`‏ (همان JSON ای که ‎web/lib/redis-source.ts‎
    می‌خواند) هر دو کلید معرف را برای هر سکو دارد."""
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
