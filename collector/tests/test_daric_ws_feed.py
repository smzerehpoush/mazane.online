"""خوراک وب‌سوکت داریک (دفتر سفارش) + زیرساخت ws — بدون هیچ تماس شبکه‌ای.

فیکسچر `fixtures/daric_ws_frames.json` **دست‌نویس** است: پوشش استاندارد
SignalR (handshake، پینگ، invocation با جداکننده‌ی 0x1E) دور payload
هم‌شکل REST. شکل فریم زنده «تأییدنشده» ماند (سند تحقیق ۰۱، «نتوانستم
تأیید کنم» ردیف ۱؛ endpoint ‏negotiate ‏SignalR بودن hub را تأیید کرد) —
هر فریم غیرمنتظره در decode نادیده می‌رود و REST خوراک اصلی می‌ماند.

آنچه این تست‌ها قفل می‌کنند (معیار پذیرش بلیت ۵):
- فریم ضبط‌شده ⟸ ردیف‌های ذخیره‌شده، با همان parse خوراک REST.
- وب‌سوکتِ وصل ⟸ داده‌ی تازه‌تر مقدم بر REST؛ **قطع وب‌سوکت ⟸ فقط
  برگشتن به REST یا کهنگی — هرگز خطا/سقوط.**
- کلاینت reconnect دار: backoff نمایی، ریست با فریم سالم، همیشه زنده.
"""

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from mazane_collector.adapters.daric import (
    DARIC_REST_ENDPOINT,
    DARIC_WS_ENDPOINT,
    DaricAdapter,
    decode_signalr_message,
)
from mazane_collector.models import Side
from mazane_collector.pipeline import collect_round
from mazane_collector.platforms import PLATFORMS
from mazane_collector.store.memory import InMemoryStore
from mazane_collector.ws import FeedCache, FeedStale, ReconnectingFeedClient, compose_fetch

FIXTURES = Path(__file__).parent / "fixtures"
FETCHED_AT = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)


def load_frames() -> list[str]:
    frames: list[str] = json.loads(
        (FIXTURES / "daric_ws_frames.json").read_text(encoding="utf-8")
    )
    return frames


def load_rest_payload() -> Any:
    return json.loads((FIXTURES / "daric_topprice.json").read_text(encoding="utf-8"))


def decode_all(frames: list[str]) -> Any:
    payload = None
    for frame in frames:
        decoded = decode_signalr_message(frame)
        if decoded is not None:
            payload = decoded
    return payload


# ― رمزگشایی فریم SignalR ―


def test_handshake_and_ping_frames_are_ignored_not_errors() -> None:
    frames = load_frames()
    assert decode_signalr_message(frames[0]) is None  # پاسخ handshake: {}
    assert decode_signalr_message(frames[1]) is None  # پینگ: type 6
    assert decode_signalr_message("مزخرف نه-JSON") is None  # فریم ناشناخته


def test_invocation_frame_yields_rest_shaped_payload() -> None:
    payload = decode_all(load_frames())
    assert payload is not None
    assert payload["bestBuy"]["price"] == 18425000.0
    assert payload["bestSell"]["price"] == 18581000.0


def test_multi_record_message_yields_last_payload() -> None:
    """یک پیام ws می‌تواند چند رکورد 0x1E-جدا داشته باشد — آخرین قیمت می‌ماند."""
    frames = load_frames()
    combined = frames[1] + frames[2]  # پینگ + invocation در یک پیام
    payload = decode_signalr_message(combined)
    assert payload is not None
    assert payload["bestSell"]["price"] == 18581000.0


# ― مرز گردآورنده: فریم ⟸ ردیف‌های استور (همان parse خوراک REST) ―


async def test_ws_frame_payload_is_stored_via_the_same_daric_parse() -> None:
    payload = decode_all(load_frames())
    snapshot = DaricAdapter().parse(payload, FETCHED_AT)
    store = InMemoryStore()
    await store.save_snapshot(snapshot)

    stored = await store.get_snapshot("daric")
    assert stored is not None
    by_side = {q.side: q for q in stored.quotes}
    assert by_side[Side.BUY].price_toman == 18581000  # bestSell دفتر
    assert by_side[Side.SELL].price_toman == 18425000  # bestBuy دفتر
    assert by_side[Side.MID].price_toman == 18503000


# ― «دو خوراک، یک سکو»: تقدم وب‌سوکت، برگشت به REST، کهنگی نه خطا ―


def make_http_fetcher(payloads: dict[str, Any]) -> Any:
    async def fetch_json(url: str) -> Any:
        return payloads[url]

    return fetch_json


async def test_fresh_ws_frame_takes_priority_over_rest_in_a_round() -> None:
    cache = FeedCache(max_age_seconds=90)
    cache.put(DARIC_WS_ENDPOINT, decode_all(load_frames()))
    fetch = compose_fetch(
        make_http_fetcher({DARIC_REST_ENDPOINT: load_rest_payload()}),
        cache,
        ws_primary={DARIC_REST_ENDPOINT: DARIC_WS_ENDPOINT},
    )
    store = InMemoryStore()

    await collect_round(
        (DaricAdapter(),), fetch, store, platforms=PLATFORMS, now=FETCHED_AT
    )

    stored = await store.get_snapshot("daric")
    assert stored is not None
    mid = next(q for q in stored.quotes if q.side is Side.MID)
    assert mid.price_toman == 18503000  # عدد وب‌سوکت، نه REST (18501634)


async def test_disconnected_ws_falls_back_to_rest_without_error() -> None:
    """قطع/سکوت وب‌سوکت داریک حتی کهنگی هم نمی‌سازد — خوراک اصلی REST است."""
    stale_clock = datetime(2026, 8, 6, 9, 0, 0, tzinfo=UTC)
    cache = FeedCache(max_age_seconds=90, now=lambda: stale_clock)
    cache.put(DARIC_WS_ENDPOINT, decode_all(load_frames()))
    # فریم در ساعت ۹:۰۰ آمد؛ نوبت گردآوری ۳۰ دقیقه بعد است ⟸ فریم کهنه.
    stale_clock = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)

    fetch = compose_fetch(
        make_http_fetcher({DARIC_REST_ENDPOINT: load_rest_payload()}),
        cache,
        ws_primary={DARIC_REST_ENDPOINT: DARIC_WS_ENDPOINT},
    )
    store = InMemoryStore()

    await collect_round(
        (DaricAdapter(),), fetch, store, platforms=PLATFORMS, now=FETCHED_AT
    )

    stored = await store.get_snapshot("daric")
    assert stored is not None
    mid = next(q for q in stored.quotes if q.side is Side.MID)
    assert mid.price_toman == 18501634  # عدد REST


def test_feed_cache_raises_feed_stale_for_missing_or_old_frames() -> None:
    clock = [datetime(2026, 8, 6, 9, 0, 0, tzinfo=UTC)]
    cache = FeedCache(max_age_seconds=90, now=lambda: clock[0])

    with pytest.raises(FeedStale):
        cache.latest(DARIC_WS_ENDPOINT)

    cache.put(DARIC_WS_ENDPOINT, {"bestBuy": None, "bestSell": None})
    assert cache.latest(DARIC_WS_ENDPOINT) is not None

    clock[0] = datetime(2026, 8, 6, 9, 2, 0, tzinfo=UTC)  # ۱۲۰ ثانیه بعد
    with pytest.raises(FeedStale):
        cache.latest(DARIC_WS_ENDPOINT)


# ― کلاینت reconnect دار: قطع ⟸ اتصال دوباره با backoff؛ هرگز سقوط ―


async def test_reconnecting_client_caches_frames_and_reconnects_with_backoff() -> None:
    frames = load_frames()
    connections: list[int] = []
    sleeps: list[float] = []
    cache = FeedCache(max_age_seconds=3600)

    @asynccontextmanager
    async def connector() -> Any:
        connections.append(len(connections) + 1)
        attempt = len(connections)
        if attempt == 1:
            # اتصال اول: فریم می‌دهد بعد وسط کار قطع می‌شود.
            async def first() -> Any:
                for frame in frames:
                    yield frame
                raise ConnectionError("connection reset")

            yield first()
        elif attempt == 2:
            # اتصال دوم: تمیز بسته می‌شود (پایان iterator هم یعنی قطع).
            async def second() -> Any:
                yield frames[2]

            yield second()
        else:
            # از اتصال سوم به بعد: حتی وصل هم نمی‌شود.
            raise ConnectionError("connection refused")

    async def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)
        if len(sleeps) >= 4:
            raise asyncio.CancelledError  # پایان تست — معادل خاموشی فرایند

    client = ReconnectingFeedClient(
        DARIC_WS_ENDPOINT,
        connector,
        decode_signalr_message,
        cache,
        initial_backoff_seconds=1.0,
        max_backoff_seconds=60.0,
        sleep=fake_sleep,
    )

    with pytest.raises(asyncio.CancelledError):
        await client.run()

    # فریم‌ها به کش رسیدند و هر قطع فقط اتصال دوباره ساخت، نه استثنای دیگر.
    assert cache.latest(DARIC_WS_ENDPOINT)["bestSell"]["price"] == 18581000.0
    assert connections == [1, 2, 3, 4]
    # backoff: بعد از هر اتصالِ فریم‌دار ریست (۱)، بعد شکست‌های پیاپی ⟸ نمایی.
    assert sleeps == [1.0, 1.0, 2.0, 4.0]
