import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from tablo_collector.adapters.baazar import BAAZAR_ENDPOINT, BaazarAdapter
from tablo_collector.adapters.daric import DARIC_REST_ENDPOINT, DaricAdapter
from tablo_collector.adapters.digikala import DIGIKALA_ENDPOINT, DigikalaAdapter
from tablo_collector.adapters.ecogold import ECOGOLD_ENDPOINT, EcogoldAdapter
from tablo_collector.adapters.goldika import GOLDIKA_ENDPOINT, GoldikaAdapter
from tablo_collector.adapters.hamrahgold import HAMRAHGOLD_ENDPOINT, HamrahgoldAdapter
from tablo_collector.adapters.invi import INVI_WS_ENDPOINT, InviAdapter
from tablo_collector.adapters.melligold import MELLIGOLD_ENDPOINT, MelligoldAdapter
from tablo_collector.adapters.milli import MILLI_ENDPOINT, MilliAdapter
from tablo_collector.adapters.talasea import TALASEA_ENDPOINT, TalaseaAdapter
from tablo_collector.adapters.technogold import TECHNOGOLD_ENDPOINT, TechnogoldAdapter
from tablo_collector.adapters.tlyn import TLYN_ENDPOINT, TlynAdapter
from tablo_collector.adapters.wallgold import WALLGOLD_ENDPOINT, WallgoldAdapter
from tablo_collector.adapters.zarafza import ZARAFZA_ENDPOINT, ZarafzaAdapter
from tablo_collector.models import FeeSource, Side
from tablo_collector.pipeline import collect_round
from tablo_collector.platforms import PLATFORMS
from tablo_collector.store.memory import InMemoryStore

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)

ALL_ADAPTERS = (
    WallgoldAdapter(),
    TalaseaAdapter(),
    MilliAdapter(),
    GoldikaAdapter(),
    TechnogoldAdapter(),
    TlynAdapter(),
    EcogoldAdapter(),
    ZarafzaAdapter(),
    BaazarAdapter(),
    DaricAdapter(),
    MelligoldAdapter(),
    DigikalaAdapter(),
    HamrahgoldAdapter(),
    InviAdapter(),
)

FIXTURE_BY_ENDPOINT = {
    WALLGOLD_ENDPOINT: "wallgold_markets.json",
    TALASEA_ENDPOINT: "talasea_gold_price.json",
    MILLI_ENDPOINT: "milli_price_external.json",
    GOLDIKA_ENDPOINT: "goldika_v2_price.json",
    TECHNOGOLD_ENDPOINT: "technogold_only_price.json",
    TLYN_ENDPOINT: "tlyn_price.json",
    ECOGOLD_ENDPOINT: "ecogold_prices_otc.json",
    ZARAFZA_ENDPOINT: "zarafza_prices.json",
    BAAZAR_ENDPOINT: "baazar_price_daily.json",
    DARIC_REST_ENDPOINT: "daric_collateral_price.json",
    MELLIGOLD_ENDPOINT: "melligold_buy_sell_price.json",
    DIGIKALA_ENDPOINT: "digikala_prices.json",
    HAMRAHGOLD_ENDPOINT: "hamrahgold_xau_changes.json",
    INVI_WS_ENDPOINT: "invi_ws_price.json",
}

KNOWN_FEE_LISTED = (
    "wallgold",
    "talasea",
    "milli",
    "goldika",
    "technogold",
    "tlyn",
    "ecogold",
    "zarafza",
    "baazar",
    "daric",
)
UNKNOWN_FEE_LISTED = ("melligold", "digikala", "hamrahgold", "invi")

LISTED_SLUGS = KNOWN_FEE_LISTED + UNKNOWN_FEE_LISTED


def make_fetcher() -> Any:
    async def fetch_json(url: str) -> Any:
        name = FIXTURE_BY_ENDPOINT[url]
        return json.loads((FIXTURES / name).read_text(encoding="utf-8"))

    return fetch_json


async def test_healthy_round_publishes_all_fourteen_sources() -> None:
    store = InMemoryStore()

    saved = await collect_round(
        ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT
    )

    assert len(saved) == 14
    assert all(not snapshot.suppressed for snapshot in saved)
    for adapter in ALL_ADAPTERS:
        assert await store.get_snapshot(adapter.slug) is not None
        assert await store.get_updated_at(adapter.slug) == FETCHED_AT


async def test_fee_columns_are_null_only_for_unknown_fee_platforms() -> None:
    store = InMemoryStore()

    await collect_round(ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT)

    for slug in UNKNOWN_FEE_LISTED:
        snapshot = await store.get_snapshot(slug)
        assert snapshot is not None
        assert [q.side for q in snapshot.quotes] == [Side.PRICE]
        assert snapshot.terms.fee_source == FeeSource.UNKNOWN
        assert snapshot.terms.round_trip_percent is None

    for slug in KNOWN_FEE_LISTED:
        snapshot = await store.get_snapshot(slug)
        assert snapshot is not None
        assert [q.side for q in snapshot.quotes] == [Side.PRICE]
        assert snapshot.terms.fee_source != FeeSource.UNKNOWN
        assert snapshot.terms.round_trip_percent is not None


async def test_listed_payload_keeps_platforms_registry_order() -> None:
    store = InMemoryStore()

    await collect_round(ALL_ADAPTERS, make_fetcher(), store, platforms=PLATFORMS, now=FETCHED_AT)

    listed = await store.get_listed_platforms()
    assert tuple(p.slug for p in listed) == KNOWN_FEE_LISTED + UNKNOWN_FEE_LISTED


async def test_listed_payload_shape_carries_market_model() -> None:
    store = InMemoryStore()
    await store.save_platforms(PLATFORMS)

    listed = await store.get_listed_platforms()
    for platform in listed:
        payload = platform.model_dump(mode="json")
        assert set(payload) == {
            "slug",
            "name_fa",
            "data_policy",
            "market_model",
            "name_en",
            "website_url",
            "legal_entity",
            "delivery_note_fa",
            "referral_url",
            "referral_param",
        }
        assert payload["data_policy"] == "ALLOWED"
        expected = "ORDER_BOOK" if payload["slug"] == "daric" else "OTC"
        assert payload["market_model"] == expected
        assert isinstance(payload["website_url"], str)
        assert payload["website_url"].startswith("https://")
    assert "daric" in {p.slug for p in listed}
    by_slug = {p.slug: p for p in listed}
    assert by_slug["talasea"].legal_entity == "شرکت توسعه راهکار الوند ارسباران"
    assert by_slug["milli"].delivery_note_fa == "کارمزد تحویل فیزیکی ۳٪"
    assert by_slug["wallgold"].legal_entity is None
    assert by_slug["wallgold"].delivery_note_fa is None
