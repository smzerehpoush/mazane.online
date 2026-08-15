import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from tablo_collector.models import Side
from tablo_collector.pipeline import AdapterError
from tablo_collector.platforms import PLATFORMS
from tablo_collector.references import ReferenceInstrument
from tablo_collector.references.pipeline import REFERENCE_SOURCES, collect_reference_round
from tablo_collector.references.talair import (
    TALAIR_BANNER_ENDPOINT,
    TALAIR_ENDPOINT,
    TalairReference,
)
from tablo_collector.store.memory import InMemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def talair_payload() -> Any:
    return json.loads((FIXTURES / "talair_price.json").read_text(encoding="utf-8"))


class FakeTransport:
    def __init__(self, get_responses: dict[str, Any], post_responses: dict[str, Any]) -> None:
        self._get = get_responses
        self._post = post_responses
        self.get_urls: list[str] = []
        self.post_data: list[dict[str, str]] = []

    async def get_text(self, url: str, *, headers: Any = None) -> str:
        self.get_urls.append(url)
        value = self._get[url]
        if isinstance(value, Exception):
            raise value
        return str(value)

    async def post_form(self, url: str, data: Any, *, headers: Any = None) -> str:
        self.post_data.append(dict(data))
        value = self._post[url]
        if isinstance(value, Exception):
            raise value
        return str(value)


def full_transport() -> FakeTransport:
    return FakeTransport(
        get_responses={
            TALAIR_ENDPOINT: json.dumps(talair_payload()),
            TALAIR_BANNER_ENDPOINT: json.dumps(
                {
                    "price": {
                        "ounce": "<span>۴,۳۷۶.۱۶</span>",
                        "dollar": "<span>۹۸,۷۰۰</span>",
                    },
                    "banner": [],
                }
            ),
        },
        post_responses={},
    )


async def test_talair_fixture_is_stored_with_attribution_and_x1_scale() -> None:
    store = InMemoryStore()
    transport = full_transport()

    await collect_reference_round(
        (TalairReference(),), transport, store, now=FETCHED_AT
    )

    assert TALAIR_BANNER_ENDPOINT in transport.get_urls
    stored = await store.get_reference("talair")
    assert stored is not None
    assert stored.name_fa == "طلا دات‌آی‌آر"
    assert stored.source_url == "https://www.tala.ir/"
    assert stored.fetched_at == FETCHED_AT

    assert [q.instrument for q in stored.quotes] == [
        ReferenceInstrument.GOLD_18K_TOMAN,
        ReferenceInstrument.XAU,
        ReferenceInstrument.USD_TOMAN,
        ReferenceInstrument.SEKEH_EMAMI_TOMAN,
        ReferenceInstrument.SEKEH_HALF_TOMAN,
        ReferenceInstrument.SEKEH_QUARTER_TOMAN,
    ]
    quotes = {quote.instrument: quote for quote in stored.quotes}
    gold_quote = quotes[ReferenceInstrument.GOLD_18K_TOMAN]
    assert gold_quote.value == Decimal("18559700")
    assert gold_quote.side is Side.PRICE
    assert gold_quote.raw_scale == Decimal("1")
    assert gold_quote.value == gold_quote.raw_value * gold_quote.raw_scale
    ounce_quote = quotes[ReferenceInstrument.XAU]
    assert ounce_quote.value == Decimal("4376.16")
    assert ounce_quote.side is Side.PRICE
    assert ounce_quote.raw_scale == Decimal("1")
    dollar_quote = quotes[ReferenceInstrument.USD_TOMAN]
    assert dollar_quote.value == Decimal("98700")
    assert dollar_quote.side is Side.PRICE
    assert dollar_quote.raw_scale == Decimal("1")
    assert quotes[ReferenceInstrument.SEKEH_EMAMI_TOMAN].value == Decimal("185000000")
    assert quotes[ReferenceInstrument.SEKEH_HALF_TOMAN].value == Decimal("94000000")
    assert quotes[ReferenceInstrument.SEKEH_QUARTER_TOMAN].value == Decimal("52500000")


def test_talair_banner_usdt_irt_is_stored_as_usd_toman_reference() -> None:
    snapshot = TalairReference().parse(
        talair_payload(),
        FETCHED_AT,
        banner_payload={"price": {"USDT_IRT": "<span>۱۰۲,۵۰۰</span>"}},
    )

    quotes = {quote.instrument: quote for quote in snapshot.quotes}
    assert quotes[ReferenceInstrument.USD_TOMAN].value == Decimal("102500")


def test_talair_banner_coin_price_wins_over_main_payload() -> None:
    snapshot = TalairReference().parse(
        talair_payload(),
        FETCHED_AT,
        banner_payload={"price": {"SEKEH_E": "<span>۲۰۰,۰۰۰,۰۰۰</span>"}},
    )

    quotes = {quote.instrument: quote for quote in snapshot.quotes}
    assert quotes[ReferenceInstrument.SEKEH_EMAMI_TOMAN].value == Decimal("200000000")
    assert quotes[ReferenceInstrument.SEKEH_HALF_TOMAN].value == Decimal("94000000")
    assert quotes[ReferenceInstrument.SEKEH_QUARTER_TOMAN].value == Decimal("52500000")


async def test_talair_empty_banner_keeps_coin_references_from_main_payload() -> None:
    store = InMemoryStore()

    await collect_reference_round(
        (
            TalairReference(),
        ),
        FakeTransport(
            get_responses={
                TALAIR_ENDPOINT: json.dumps(talair_payload()),
                TALAIR_BANNER_ENDPOINT: json.dumps({"banner": []}),
            },
            post_responses={},
        ),
        store,
        now=FETCHED_AT,
    )

    stored = await store.get_reference("talair")
    assert stored is not None
    assert [q.instrument for q in stored.quotes] == [
        ReferenceInstrument.GOLD_18K_TOMAN,
        ReferenceInstrument.SEKEH_EMAMI_TOMAN,
        ReferenceInstrument.SEKEH_HALF_TOMAN,
        ReferenceInstrument.SEKEH_QUARTER_TOMAN,
    ]


async def test_talair_broken_gold_18k_means_stale_reference_not_bad_data() -> None:
    payload = talair_payload()
    payload["gold"]["gold_18k"]["v"] = "0"
    store = InMemoryStore()

    with pytest.raises(AdapterError):
        TalairReference().parse(payload, FETCHED_AT)

    transport = FakeTransport(
        get_responses={TALAIR_ENDPOINT: json.dumps(payload)}, post_responses={}
    )
    saved = await collect_reference_round(
        (TalairReference(),), transport, store, now=FETCHED_AT
    )
    assert saved == ()
    assert await store.get_reference("talair") is None


async def test_references_are_stored_but_never_platforms_nor_listed() -> None:
    store = InMemoryStore()
    await store.save_platforms(PLATFORMS)

    saved = await collect_reference_round(
        REFERENCE_SOURCES, full_transport(), store, now=FETCHED_AT
    )
    assert {s.reference_slug for s in saved} == {"talair"}

    assert await store.get_reference("talair") is not None
    assert {s.reference_slug for s in store.reference_history} == {"talair"}

    listed_slugs = {p.slug for p in await store.get_listed_platforms()}
    assert "talair" not in listed_slugs
    assert "talair" not in {p.slug for p in PLATFORMS}
    assert await store.get_snapshot("talair") is None


async def test_dead_reference_does_not_break_the_round() -> None:
    transport = FakeTransport(
        get_responses={TALAIR_ENDPOINT: ConnectionError("connection refused")},
        post_responses={},
    )
    store = InMemoryStore()

    saved = await collect_reference_round(
        REFERENCE_SOURCES, transport, store, now=FETCHED_AT
    )

    assert saved == ()
    assert await store.get_reference("talair") is None


async def test_bonbast_is_gone_from_the_reference_roster() -> None:
    assert [source.slug for source in REFERENCE_SOURCES] == ["talair"]
