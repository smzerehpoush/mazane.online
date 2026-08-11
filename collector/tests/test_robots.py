"""مرز گردآورنده — داوری `robots.txt` در زمان اجرا (قاعده‌ی ۶ قراردادها).

اندپوینت‌ها در زمان طراحی بررسی شده‌اند (سند تحقیق ۰۱)، ولی `robots.txt`
سند زنده است: هر میزبان می‌تواند فردا مسیری را ببندد. این تست‌ها قفل
می‌کنند که دروازه‌ی robots:

- با اجازه‌ی کامل، هیچ‌چیز را تغییر نمی‌دهد و هر میزبان فقط یک‌بار در هر
  TTL خوانده می‌شود؛
- مسیر ممنوع‌شده ⟸ لاگ + کهنگی همان منبع (نه سقوط نوبت) — مهم‌ترین
  مصداق: اسکریپر HTML بن‌بست؛
- نبودِ `robots.txt` (پاسخ ۴۰۴) یعنی همه‌چیز مجاز؛
- قطعی `robots.txt` (پاسخ ۵۰۰ یا خطای شبکه) **باز-به-شکست** است با هشدار
  در لاگ — تصمیم مستند ماژول `tablo_collector.robots`: قطعی robots نباید
  گردآوری اندپوینت‌های ازپیش‌بررسی‌شده را متوقف کند.

پاسخ‌های `robots.txt` از فیکسچرهای همین پوشه می‌آیند؛ هیچ تماس شبکه‌ای نیست.
"""

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from tablo_collector.adapters.goldika import GOLDIKA_ENDPOINT, GoldikaAdapter
from tablo_collector.adapters.milli import MILLI_ENDPOINT, MilliAdapter
from tablo_collector.adapters.talasea import TALASEA_ENDPOINT, TalaseaAdapter
from tablo_collector.adapters.wallgold import WALLGOLD_ENDPOINT, WallgoldAdapter
from tablo_collector.main import USER_AGENT
from tablo_collector.pipeline import collect_round
from tablo_collector.platforms import PLATFORMS
from tablo_collector.references.pipeline import (
    REFERENCE_SOURCES,
    collect_reference_round,
)
from tablo_collector.references.talair import TALAIR_ENDPOINT
from tablo_collector.references.transport import RobotsCheckedTransport
from tablo_collector.robots import (
    PERMISSION_OVERRIDE_HOSTS,
    ROBOTS_TTL_SECONDS,
    RobotsGate,
    robots_checked_fetch,
)
from tablo_collector.store.memory import InMemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)
ROBOTS_LOGGER = "mazane.collector.robots"

ALL_ADAPTERS = (WallgoldAdapter(), TalaseaAdapter(), MilliAdapter(), GoldikaAdapter())
ALL_ENDPOINTS = (WALLGOLD_ENDPOINT, TALASEA_ENDPOINT, MILLI_ENDPOINT, GOLDIKA_ENDPOINT)

# میزبانی که اجازه‌نامه‌ی کتبی مالک دارد اصلاً robots.txt‌اش خوانده نمی‌شود
# (`PERMISSION_OVERRIDE_HOSTS` در ماژول robots — طلاسی از ۲۰۲۶-۰۸-۰۶).
# شمارش‌های «هر میزبان یک‌بار» باید از همین مجموعه مشتق شوند، نه عدد ثابت،
# تا افزودن اجازه‌نامه‌ی بعدی تست را بی‌دلیل قرمز نکند.
ROBOTS_CHECKED_ENDPOINTS = tuple(
    endpoint
    for endpoint in ALL_ENDPOINTS
    if urlsplit(endpoint).hostname not in PERMISSION_OVERRIDE_HOSTS
)


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def load_json(name: str) -> Any:
    return json.loads(fixture_text(name))


def robots_url(endpoint: str) -> str:
    parts = urlsplit(endpoint)
    return f"{parts.scheme}://{parts.netloc}/robots.txt"


@dataclass
class RobotsResponse:
    status_code: int
    text: str = ""


class FakeRobotsClient:
    """فیک کلاینت خواندن `robots.txt`: پاسخ هر میزبان + شمارش برای تست کش."""

    def __init__(self, responses: dict[str, Any]) -> None:
        self.responses = responses
        self.calls: list[str] = []

    async def get(self, url: str) -> Any:
        self.calls.append(url)
        value = self.responses[url]
        if isinstance(value, Exception):
            raise value
        return value


class FakeClock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def allow_all_everywhere() -> dict[str, Any]:
    text = fixture_text("robots_allow_all.txt")
    return {robots_url(e): RobotsResponse(200, text) for e in ALL_ENDPOINTS}


def all_payloads() -> dict[str, Any]:
    return {
        WALLGOLD_ENDPOINT: load_json("wallgold_markets.json"),
        TALASEA_ENDPOINT: load_json("talasea_gold_price.json"),
        MILLI_ENDPOINT: load_json("milli_price_external.json"),
        GOLDIKA_ENDPOINT: load_json("goldika_v2_price.json"),
    }


def make_fetcher(payloads: dict[str, Any]) -> Any:
    async def fetch_json(url: str) -> Any:
        return payloads[url]

    return fetch_json


# ― داوری خود دروازه (توکن UA و اسکیم‌ها) ―


async def test_gate_honors_rules_aimed_at_our_user_agent_token() -> None:
    responses = {
        robots_url(WALLGOLD_ENDPOINT): RobotsResponse(
            200, fixture_text("robots_disallow_tablobot.txt")
        )
    }
    gate = RobotsGate(FakeRobotsClient(responses), user_agent=USER_AGENT)

    assert await gate.allows(WALLGOLD_ENDPOINT) is False


async def test_gate_ignores_rules_aimed_at_other_bots() -> None:
    responses = {
        robots_url(WALLGOLD_ENDPOINT): RobotsResponse(
            200, fixture_text("robots_disallow_other_bot.txt")
        )
    }
    gate = RobotsGate(FakeRobotsClient(responses), user_agent=USER_AGENT)

    assert await gate.allows(WALLGOLD_ENDPOINT) is True


async def test_non_http_urls_pass_without_robots_lookup() -> None:
    """`robots.txt` فقط برای HTTP معناست — خوراک وب‌سوکت بی‌داوری رد می‌شود."""
    client = FakeRobotsClient({})
    gate = RobotsGate(client, user_agent=USER_AGENT)

    assert await gate.allows("wss://ws.example.ir/feed") is True
    assert client.calls == []


# ― مرز گردآورنده: نوبت سکوها ―


async def test_allowed_robots_leaves_the_round_untouched_one_fetch_per_host() -> None:
    robots_client = FakeRobotsClient(allow_all_everywhere())
    gate = RobotsGate(robots_client, user_agent=USER_AGENT)
    fetch = robots_checked_fetch(gate, make_fetcher(all_payloads()))
    store = InMemoryStore()

    saved = await collect_round(
        ALL_ADAPTERS, fetch, store, platforms=PLATFORMS, now=FETCHED_AT
    )

    assert {s.platform_slug for s in saved} == {"wallgold", "talasea", "milli", "goldika"}
    # هر میزبان دقیقاً یک‌بار خوانده شد — کرال مؤدب برای خود robots هم.
    assert set(robots_client.calls) == {robots_url(e) for e in ROBOTS_CHECKED_ENDPOINTS}
    assert len(robots_client.calls) == len(set(robots_client.calls))


async def test_disallowed_endpoint_is_skipped_as_staleness_not_crash(
    caplog: Any,
) -> None:
    responses = allow_all_everywhere()
    responses[robots_url(WALLGOLD_ENDPOINT)] = RobotsResponse(
        200, fixture_text("robots_disallow_tablobot.txt")
    )
    gate = RobotsGate(FakeRobotsClient(responses), user_agent=USER_AGENT)
    fetch = robots_checked_fetch(gate, make_fetcher(all_payloads()))
    store = InMemoryStore()

    with caplog.at_level(logging.WARNING, logger=ROBOTS_LOGGER):
        saved = await collect_round(
            ALL_ADAPTERS, fetch, store, platforms=PLATFORMS, now=FETCHED_AT
        )

    # فقط همان منبع کنار رفت؛ نوبت کامل شد.
    assert {s.platform_slug for s in saved} == {"talasea", "milli", "goldika"}
    assert await store.get_snapshot("wallgold") is None
    assert await store.get_updated_at("wallgold") is None
    # هشدار روشن با خود URL در لاگ robots.
    robots_warnings = [
        r.getMessage() for r in caplog.records if r.name == ROBOTS_LOGGER
    ]
    assert any(WALLGOLD_ENDPOINT in message for message in robots_warnings)


async def test_missing_robots_txt_means_everything_is_allowed() -> None:
    responses = {robots_url(e): RobotsResponse(404) for e in ALL_ENDPOINTS}
    gate = RobotsGate(FakeRobotsClient(responses), user_agent=USER_AGENT)
    fetch = robots_checked_fetch(gate, make_fetcher(all_payloads()))
    store = InMemoryStore()

    saved = await collect_round(
        ALL_ADAPTERS, fetch, store, platforms=PLATFORMS, now=FETCHED_AT
    )

    assert len(saved) == 4


async def test_robots_outage_fails_open_with_warning(caplog: Any) -> None:
    """تصمیم مستند: ۵۰۰ یا خطای شبکه روی `robots.txt` گردآوری را نمی‌ایستاند."""
    responses = allow_all_everywhere()
    responses[robots_url(WALLGOLD_ENDPOINT)] = RobotsResponse(500)
    responses[robots_url(GOLDIKA_ENDPOINT)] = ConnectionError("connection refused")
    gate = RobotsGate(FakeRobotsClient(responses), user_agent=USER_AGENT)
    fetch = robots_checked_fetch(gate, make_fetcher(all_payloads()))
    store = InMemoryStore()

    with caplog.at_level(logging.WARNING, logger=ROBOTS_LOGGER):
        saved = await collect_round(
            ALL_ADAPTERS, fetch, store, platforms=PLATFORMS, now=FETCHED_AT
        )

    assert len(saved) == 4  # هیچ منبعی به‌خاطر قطعی robots نایستاد.
    robots_warnings = [r for r in caplog.records if r.name == ROBOTS_LOGGER]
    assert len(robots_warnings) == 2  # یکی برای ۵۰۰، یکی برای خطای شبکه.


async def test_cache_ttl_and_url_that_becomes_disallowed(caplog: Any) -> None:
    """کش ۲۴ ساعته + سناریوی اصلی بلیت: مسیرِ تازه‌ممنوع‌شده کهنگی می‌سازد."""
    clock = FakeClock()
    robots_client = FakeRobotsClient(allow_all_everywhere())
    gate = RobotsGate(robots_client, user_agent=USER_AGENT, clock=clock)
    fetch = robots_checked_fetch(gate, make_fetcher(all_payloads()))
    store = InMemoryStore()
    second_at = FETCHED_AT + timedelta(seconds=30)
    third_at = FETCHED_AT + timedelta(seconds=60)

    first = await collect_round(
        ALL_ADAPTERS, fetch, store, platforms=PLATFORMS, now=FETCHED_AT
    )
    assert len(first) == 4
    assert len(robots_client.calls) == len(ROBOTS_CHECKED_ENDPOINTS)

    # میزبان والدگلد مسیر را می‌بندد؛ تا سررسید TTL همان برداشت کش معتبر است.
    robots_client.responses[robots_url(WALLGOLD_ENDPOINT)] = RobotsResponse(
        200, fixture_text("robots_disallow_tablobot.txt")
    )
    second = await collect_round(
        ALL_ADAPTERS, fetch, store, platforms=PLATFORMS, now=second_at
    )
    assert "wallgold" in {s.platform_slug for s in second}
    # درون TTL هیچ خواندن تازه‌ای نیست.
    assert len(robots_client.calls) == len(ROBOTS_CHECKED_ENDPOINTS)

    # پس از TTL خواندن تازه ممنوعیت را می‌بیند: لاگ + کهنگی، نه سقوط.
    clock.advance(ROBOTS_TTL_SECONDS + 1)
    with caplog.at_level(logging.WARNING, logger=ROBOTS_LOGGER):
        third = await collect_round(
            ALL_ADAPTERS, fetch, store, platforms=PLATFORMS, now=third_at
        )
    assert len(robots_client.calls) == 2 * len(ROBOTS_CHECKED_ENDPOINTS)
    assert {s.platform_slug for s in third} == {"talasea", "milli", "goldika"}
    # کهنگی یعنی آخرین داده‌ی مجاز می‌ماند و جلو نمی‌رود؛ بقیه تازه می‌شوند.
    assert await store.get_updated_at("wallgold") == second_at
    assert await store.get_updated_at("talasea") == third_at
    assert any(
        WALLGOLD_ENDPOINT in r.getMessage()
        for r in caplog.records
        if r.name == ROBOTS_LOGGER
    )


# ― مرز گردآورنده: نوبت مراجع (بن‌بست مهم‌ترین مصداق است) ―


class FakeReferenceTransport:
    """فیک قرارداد ReferenceTransport — مثل تست مراجع، با ثبت POSTها."""

    def __init__(self, get_responses: dict[str, str], post_responses: dict[str, str]) -> None:
        self._get = get_responses
        self._post = post_responses
        self.posted: list[str] = []

    async def get_text(self, url: str, *, headers: Any = None) -> str:
        return self._get[url]

    async def post_form(self, url: str, data: Any, *, headers: Any = None) -> str:
        self.posted.append(url)
        return self._post[url]


async def test_allowed_robots_leaves_reference_round_untouched() -> None:
    """تنها مرجع باقی‌مانده طلا دات‌آی‌آر است (سند تصمیم ۰۰۰۲).

    تست «Disallow روی مسیر POST» با حذف بن‌بست موضوعش را از دست داد: هیچ
    مرجعی دیگر گردش دومرحله‌ای (GET صفحه ⟸ POST توکن) ندارد. داوری robots
    برای GET همچنان در تست‌های سکوها پوشش دارد.
    """
    text = fixture_text("robots_allow_all.txt")
    responses = {robots_url(TALAIR_ENDPOINT): RobotsResponse(200, text)}
    gate = RobotsGate(FakeRobotsClient(responses), user_agent=USER_AGENT)
    inner = FakeReferenceTransport(
        get_responses={TALAIR_ENDPOINT: json.dumps(load_json("talair_price.json"))},
        post_responses={},
    )
    transport = RobotsCheckedTransport(gate, inner)
    store = InMemoryStore()

    saved = await collect_reference_round(
        REFERENCE_SOURCES, transport, store, now=FETCHED_AT
    )

    assert {s.reference_slug for s in saved} == {"talair"}
    assert inner.posted == []


async def test_permission_override_hosts_bypass_full_disallow() -> None:
    """اجازه‌نامه‌ی کتبی مالک (۲۰۲۶-۰۸-۰۶) بر Disallow کامل robots مقدم است.

    طلاین و همراه‌گلد در robots.txt واقعی‌شان `Disallow: /` دارند؛ بدون
    override این تست قرمز می‌شود (رفتار پیش از اجازه‌نامه).
    """
    disallow_all = "User-agent: *\nDisallow: /"
    client = FakeRobotsClient(
        {"https://other.example/robots.txt": RobotsResponse(200, disallow_all)}
    )
    gate = RobotsGate(client, user_agent=USER_AGENT)

    # میزبان‌های اجازه‌نامه‌دار حتی بدون خواندن robots مجازند (کلاینت پاسخی
    # برایشان ندارد — اگر خوانده می‌شد KeyError می‌داد).
    assert await gate.allows("https://price.tlyn.ir/api/v1/price") is True
    assert (
        await gate.allows("https://pwa.hamrahgold.com/api/v1/market/price/xau/changes")
        is True
    )
    # میزبان بدون اجازه‌نامه همچنان داوری می‌شود.
    assert await gate.allows("https://other.example/x") is False
