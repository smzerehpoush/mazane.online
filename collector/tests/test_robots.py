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
  در لاگ — تصمیم مستند ماژول `mazane_collector.robots`: قطعی robots نباید
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

from mazane_collector.adapters.goldika import GOLDIKA_ENDPOINT, GoldikaAdapter
from mazane_collector.adapters.milli import MILLI_ENDPOINT, MilliAdapter
from mazane_collector.adapters.talasea import TALASEA_ENDPOINT, TalaseaAdapter
from mazane_collector.adapters.wallgold import WALLGOLD_ENDPOINT, WallgoldAdapter
from mazane_collector.main import USER_AGENT
from mazane_collector.pipeline import collect_round
from mazane_collector.platforms import PLATFORMS
from mazane_collector.references.bonbast import (
    BONBAST_JSON_ENDPOINT,
    BONBAST_PAGE_ENDPOINT,
)
from mazane_collector.references.pipeline import (
    REFERENCE_SOURCES,
    collect_reference_round,
)
from mazane_collector.references.talair import TALAIR_ENDPOINT
from mazane_collector.references.transport import RobotsCheckedTransport
from mazane_collector.robots import (
    ROBOTS_TTL_SECONDS,
    RobotsGate,
    robots_checked_fetch,
)
from mazane_collector.store.memory import InMemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)
ROBOTS_LOGGER = "mazane.collector.robots"

ALL_ADAPTERS = (WallgoldAdapter(), TalaseaAdapter(), MilliAdapter(), GoldikaAdapter())
ALL_ENDPOINTS = (WALLGOLD_ENDPOINT, TALASEA_ENDPOINT, MILLI_ENDPOINT, GOLDIKA_ENDPOINT)


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
            200, fixture_text("robots_disallow_mazanebot.txt")
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
    assert set(robots_client.calls) == {robots_url(e) for e in ALL_ENDPOINTS}
    assert len(robots_client.calls) == len(set(robots_client.calls))


async def test_disallowed_endpoint_is_skipped_as_staleness_not_crash(
    caplog: Any,
) -> None:
    responses = allow_all_everywhere()
    responses[robots_url(WALLGOLD_ENDPOINT)] = RobotsResponse(
        200, fixture_text("robots_disallow_mazanebot.txt")
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
    assert len(robots_client.calls) == 4

    # میزبان والدگلد مسیر را می‌بندد؛ تا سررسید TTL همان برداشت کش معتبر است.
    robots_client.responses[robots_url(WALLGOLD_ENDPOINT)] = RobotsResponse(
        200, fixture_text("robots_disallow_mazanebot.txt")
    )
    second = await collect_round(
        ALL_ADAPTERS, fetch, store, platforms=PLATFORMS, now=second_at
    )
    assert "wallgold" in {s.platform_slug for s in second}
    assert len(robots_client.calls) == 4  # درون TTL هیچ خواندن تازه‌ای نیست.

    # پس از TTL خواندن تازه ممنوعیت را می‌بیند: لاگ + کهنگی، نه سقوط.
    clock.advance(ROBOTS_TTL_SECONDS + 1)
    with caplog.at_level(logging.WARNING, logger=ROBOTS_LOGGER):
        third = await collect_round(
            ALL_ADAPTERS, fetch, store, platforms=PLATFORMS, now=third_at
        )
    assert len(robots_client.calls) == 8
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


async def test_bonbast_json_becoming_disallowed_stales_only_bonbast(
    caplog: Any,
) -> None:
    """گردش بن‌بست وسط راه (پیش از `POST /json`) می‌ایستد؛ طلا دات‌آی‌آر می‌ماند."""
    responses = {
        robots_url(TALAIR_ENDPOINT): RobotsResponse(
            200, fixture_text("robots_allow_all.txt")
        ),
        robots_url(BONBAST_PAGE_ENDPOINT): RobotsResponse(
            200, fixture_text("robots_disallow_json_path.txt")
        ),
    }
    gate = RobotsGate(FakeRobotsClient(responses), user_agent=USER_AGENT)
    inner = FakeReferenceTransport(
        get_responses={
            TALAIR_ENDPOINT: json.dumps(load_json("talair_price.json")),
            BONBAST_PAGE_ENDPOINT: fixture_text("bonbast_page.html"),
        },
        post_responses={BONBAST_JSON_ENDPOINT: fixture_text("bonbast_json.json")},
    )
    transport = RobotsCheckedTransport(gate, inner)
    store = InMemoryStore()

    with caplog.at_level(logging.WARNING, logger=ROBOTS_LOGGER):
        saved = await collect_reference_round(
            REFERENCE_SOURCES, transport, store, now=FETCHED_AT
        )

    assert {s.reference_slug for s in saved} == {"talair"}
    assert await store.get_reference("talair") is not None
    assert await store.get_reference("bonbast") is None
    # درخواست ممنوع اصلاً بیرون نرفت — داوری پیش از POST بود.
    assert inner.posted == []
    assert any(
        BONBAST_JSON_ENDPOINT in r.getMessage()
        for r in caplog.records
        if r.name == ROBOTS_LOGGER
    )


async def test_allowed_robots_leaves_reference_round_untouched() -> None:
    text = fixture_text("robots_allow_all.txt")
    responses = {
        robots_url(TALAIR_ENDPOINT): RobotsResponse(200, text),
        robots_url(BONBAST_PAGE_ENDPOINT): RobotsResponse(200, text),
    }
    gate = RobotsGate(FakeRobotsClient(responses), user_agent=USER_AGENT)
    inner = FakeReferenceTransport(
        get_responses={
            TALAIR_ENDPOINT: json.dumps(load_json("talair_price.json")),
            BONBAST_PAGE_ENDPOINT: fixture_text("bonbast_page.html"),
        },
        post_responses={BONBAST_JSON_ENDPOINT: fixture_text("bonbast_json.json")},
    )
    transport = RobotsCheckedTransport(gate, inner)
    store = InMemoryStore()

    saved = await collect_reference_round(
        REFERENCE_SOURCES, transport, store, now=FETCHED_AT
    )

    assert {s.reference_slug for s in saved} == {"talair", "bonbast"}
