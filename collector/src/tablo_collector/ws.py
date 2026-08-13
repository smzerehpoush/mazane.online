from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from .pipeline import FetchJson

log = logging.getLogger("mazane.collector.ws")

Clock = Callable[[], datetime]
Connector = Callable[[], AbstractAsyncContextManager[AsyncIterator[str]]]
Decoder = Callable[[str], Any | None]

DEFAULT_FRAME_MAX_AGE_SECONDS = 90.0
DEFAULT_INITIAL_BACKOFF_SECONDS = 1.0
DEFAULT_MAX_BACKOFF_SECONDS = 60.0


class FeedStale(Exception):
    pass


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class _CachedFrame:
    payload: Any
    received_at: datetime


class FeedCache:
    def __init__(
        self,
        *,
        max_age_seconds: float = DEFAULT_FRAME_MAX_AGE_SECONDS,
        now: Clock = _utc_now,
    ) -> None:
        self._max_age = timedelta(seconds=max_age_seconds)
        self._now = now
        self._frames: dict[str, _CachedFrame] = {}

    def put(self, url: str, payload: Any) -> None:
        self._frames[url] = _CachedFrame(payload=payload, received_at=self._now())

    def latest(self, url: str) -> Any:
        frame = self._frames.get(url)
        if frame is None:
            raise FeedStale(f"خوراک {url} هنوز فریمی نداده است")
        if self._now() - frame.received_at > self._max_age:
            raise FeedStale(f"آخرین فریم {url} کهنه‌تر از حد مجاز است")
        return frame.payload


def compose_fetch(
    http_fetch: FetchJson,
    cache: FeedCache,
    *,
    ws_primary: Mapping[str, str] | None = None,
) -> FetchJson:
    primary = dict(ws_primary or {})

    async def fetch(url: str) -> Any:
        ws_url = primary.get(url)
        if ws_url is not None:
            try:
                return cache.latest(ws_url)
            except FeedStale:
                pass
        if url.startswith("wss://"):
            return cache.latest(url)
        return await http_fetch(url)

    return fetch


class ReconnectingFeedClient:

    def __init__(
        self,
        url: str,
        connector: Connector,
        decode: Decoder,
        cache: FeedCache,
        *,
        initial_backoff_seconds: float = DEFAULT_INITIAL_BACKOFF_SECONDS,
        max_backoff_seconds: float = DEFAULT_MAX_BACKOFF_SECONDS,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._url = url
        self._connector = connector
        self._decode = decode
        self._cache = cache
        self._initial_backoff = initial_backoff_seconds
        self._max_backoff = max_backoff_seconds
        self._sleep = sleep

    async def run(self) -> None:
        backoff = self._initial_backoff
        while True:
            try:
                async with self._connector() as messages:
                    log.info("خوراک %s وصل شد", self._url)
                    async for raw in messages:
                        payload = self._decode(raw)
                        if payload is None:
                            continue
                        self._cache.put(self._url, payload)
                        backoff = self._initial_backoff
                log.warning("خوراک %s بسته شد — کهنگی، نه خطا؛ اتصال دوباره", self._url)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("خوراک %s قطع شد — کهنگی، نه خطا؛ اتصال دوباره", self._url)
            await self._sleep(backoff)
            backoff = min(backoff * 2, self._max_backoff)
