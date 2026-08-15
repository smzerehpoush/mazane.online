from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Sequence
from datetime import UTC, datetime
from typing import Any, Protocol

from .instruments import build_listings
from .models import Instrument, Platform, PlatformSnapshot
from .sanity import median_outliers
from .store import Store

FetchJson = Callable[[str], Awaitable[Any]]

log = logging.getLogger("mazane.collector.pipeline")


class AdapterError(Exception):
    pass


class Adapter(Protocol):
    slug: str
    endpoint: str
    instruments: tuple[Instrument, ...]

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot: ...


async def collect_once(
    adapter: Adapter,
    fetch_json: FetchJson,
    store: Store,
    *,
    now: datetime | None = None,
) -> PlatformSnapshot:
    fetched_at = now if now is not None else datetime.now(UTC)
    payload = await fetch_json(adapter.endpoint)
    snapshot = adapter.parse(payload, fetched_at)
    await store.save_snapshot(snapshot)
    return snapshot


async def collect_round(
    adapters: Sequence[Adapter],
    fetch_json: FetchJson,
    store: Store,
    *,
    platforms: Sequence[Platform],
    now: datetime | None = None,
) -> tuple[PlatformSnapshot, ...]:
    fetched_at = now if now is not None else datetime.now(UTC)

    fresh: list[PlatformSnapshot] = []
    for adapter in adapters:
        try:
            payload = await fetch_json(adapter.endpoint)
            fresh.append(adapter.parse(payload, fetched_at))
        except Exception:
            log.exception("Collecting %s failed — platform stays stale", adapter.slug)

    outliers = median_outliers(fresh)
    saved: list[PlatformSnapshot] = []
    for snapshot in fresh:
        if snapshot.platform_slug in outliers:
            log.warning(
                "median/sanity check: %s is farther from the median of other sources "
                "than the threshold — not published (history only, flagged suppressed)",
                snapshot.platform_slug,
            )
            snapshot = snapshot.model_copy(update={"suppressed": True})
        await store.save_snapshot(snapshot)
        saved.append(snapshot)

    await store.save_platforms(platforms)
    await store.save_instruments(build_listings(adapters, platforms))
    return tuple(saved)
