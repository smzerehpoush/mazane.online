from __future__ import annotations

import asyncio
import logging
import os
import sys
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import NamedTuple

from ..slugs import PUBLIC_SLUGS, SlugCollisionError, SlugError
from .gate import DraftRejected, gate_draft
from .gateway import ContentGateway

log = logging.getLogger("mazane.collector.content")

QUEUE_TARGET_DAYS = 14
QUEUE_ALERT_DAYS = 5
# ⚠️ Nothing auto-publishes any more (phase 1 removed that path); this is an
# assumed editorial cadence, used only as the divisor that turns the draft
# count into a "days of runway" estimate. The env var keeps its
# `TABLO_DAILY_PUBLISH_CAP` name — that's a deploy-config value documented in
# `ops/RUNBOOK.md` and `docs/01-overview.md` — but the Python symbols below
# describe what the number actually does now, not what it used to do.
DEFAULT_EDITORIAL_CADENCE_PER_DAY = 2


def editorial_cadence_from_env() -> int:
    raw = os.environ.get("TABLO_DAILY_PUBLISH_CAP")
    if raw is None:
        return DEFAULT_EDITORIAL_CADENCE_PER_DAY
    try:
        cadence = int(raw)
        if cadence < 1:
            raise ValueError(raw)
    except ValueError:
        log.warning(
            "TABLO_DAILY_PUBLISH_CAP=%r is invalid — defaulting to %s",
            raw,
            DEFAULT_EDITORIAL_CADENCE_PER_DAY,
        )
        return DEFAULT_EDITORIAL_CADENCE_PER_DAY
    return cadence


class QueueDepth(NamedTuple):

    drafts: int
    cadence_per_day: int
    days: float


async def enqueue_draft(
    gateway: ContentGateway,
    *,
    slug: str,
    title_template: str,
    body_template: str,
    slots: Mapping[str, str] | None = None,
    data_ok: bool = True,
    now: datetime | None = None,
) -> None:
    PUBLIC_SLUGS.validate_new_slug(slug)
    if slug in await gateway.all_slugs():
        raise SlugCollisionError(
            f"slug {slug!r} already exists in the posts table — uniqueness constraint (decision 11)"
        )
    title_fa, body_md = gate_draft(
        title_template=title_template,
        body_template=body_template,
        slots=slots if slots is not None else {},
        existing_posts=await gateway.existing_texts(),
        data_ok=data_ok,
    )
    moment = now if now is not None else datetime.now(UTC)
    await gateway.insert_draft(slug, title_fa, body_md, now=moment)
    log.info("draft %s queued", slug)


async def check_queue_depth(gateway: ContentGateway, *, cadence_per_day: int) -> QueueDepth:
    drafts = await gateway.draft_count()
    days = drafts / cadence_per_day
    if days < QUEUE_ALERT_DAYS:
        log.warning(
            "content queue depth is %.1f days (%s drafts ÷ %s assumed per-day pace) — "
            "below the %s-day threshold; target is %s days. Add manual drafts before the queue runs dry.",
            days,
            drafts,
            cadence_per_day,
            QUEUE_ALERT_DAYS,
            QUEUE_TARGET_DAYS,
        )
    return QueueDepth(drafts, cadence_per_day, days)


async def _run_enqueue(slug: str, title_template: str, body_template: str) -> None:
    import asyncpg

    from .gateway import PostgresContentGateway

    PUBLIC_SLUGS.validate_new_slug(slug)
    database_url = os.environ.get(
        "TABLO_DATABASE_URL", "postgresql://mazane:mazane@127.0.0.1:5432/mazane"
    )
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=1)
    assert pool is not None
    try:
        await enqueue_draft(
            PostgresContentGateway(pool),
            slug=slug,
            title_template=title_template,
            body_template=body_template,
        )
    finally:
        await pool.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    args = sys.argv[1:]
    if len(args) not in (2, 3):
        print("usage: tablo-enqueue <slug> <title_fa> [body.md|-]", file=sys.stderr)
        raise SystemExit(2)
    slug, title_fa = args[0], args[1]
    source = args[2] if len(args) == 3 else "-"
    body_md = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8")
    if body_md.strip() == "":
        print("empty body is not queued", file=sys.stderr)
        raise SystemExit(2)
    try:
        asyncio.run(_run_enqueue(slug, title_fa, body_md))
    except (SlugError, DraftRejected) as exc:
        print(f"rejected: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
