from __future__ import annotations

import logging
import os
from datetime import UTC, datetime

from .gateway import ContentGateway
from .queue import QueueDepth, check_queue_depth
from .revalidate import BlogRevalidator

log = logging.getLogger("mazane.collector.content")

DEFAULT_DAILY_PUBLISH_CAP = 2


def daily_publish_cap_from_env() -> int:
    raw = os.environ.get("TABLO_DAILY_PUBLISH_CAP")
    if raw is None:
        return DEFAULT_DAILY_PUBLISH_CAP
    try:
        cap = int(raw)
        if cap < 1:
            raise ValueError(raw)
    except ValueError:
        log.warning(
            "TABLO_DAILY_PUBLISH_CAP=%r is invalid — defaulting to %s",
            raw,
            DEFAULT_DAILY_PUBLISH_CAP,
        )
        return DEFAULT_DAILY_PUBLISH_CAP
    return cap


def day_start(moment: datetime) -> datetime:
    return moment.replace(hour=0, minute=0, second=0, microsecond=0)


async def publish_due(
    gateway: ContentGateway,
    revalidate: BlogRevalidator,
    *,
    now: datetime | None = None,
    daily_cap: int = DEFAULT_DAILY_PUBLISH_CAP,
) -> tuple[str, ...]:
    moment = now if now is not None else datetime.now(UTC)
    already = await gateway.published_count_since(day_start(moment))
    budget = max(0, daily_cap - already)
    if budget == 0:
        return ()

    published: list[str] = []
    for draft in await gateway.oldest_drafts(budget):
        await gateway.set_published(draft.slug, published_at=moment)
        published.append(draft.slug)
        log.info("post %s published (%s of today's cap of %s)", draft.slug, already + len(published), daily_cap)
        revalidated = False
        try:
            revalidated = await revalidate(draft.slug)
        except Exception:
            log.exception("web revalidate call for %s raised an exception", draft.slug)
        if not revalidated:
            log.warning("web revalidate for %s did not happen — ISR will compensate", draft.slug)
    return tuple(published)


async def drain_pass(
    gateway: ContentGateway,
    revalidate: BlogRevalidator,
    *,
    now: datetime | None = None,
    daily_cap: int = DEFAULT_DAILY_PUBLISH_CAP,
) -> tuple[tuple[str, ...], QueueDepth]:
    published = await publish_due(gateway, revalidate, now=now, daily_cap=daily_cap)
    depth = await check_queue_depth(gateway, daily_cap=daily_cap)
    return published, depth
