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


class QueueDepth(NamedTuple):

    drafts: int
    daily_cap: int
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
            f"اسلاگ {slug!r} قبلاً در جدول posts هست — قید یکتایی (تصمیم ۱۱)"
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
    log.info("پیش‌نویس %s صف شد", slug)


async def check_queue_depth(gateway: ContentGateway, *, daily_cap: int) -> QueueDepth:
    drafts = await gateway.draft_count()
    days = drafts / daily_cap
    if days < QUEUE_ALERT_DAYS:
        log.warning(
            "عمق صف محتوا %.1f روز است (%s پیش‌نویس ÷ سقف %s در روز) — "
            "زیر آستانه‌ی %s روز؛ هدف %s روز. مولد محلی باید صف را پر کند.",
            days,
            drafts,
            daily_cap,
            QUEUE_ALERT_DAYS,
            QUEUE_TARGET_DAYS,
        )
    return QueueDepth(drafts, daily_cap, days)


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
        print("کاربرد: tablo-enqueue <slug> <title_fa> [body.md|-]", file=sys.stderr)
        raise SystemExit(2)
    slug, title_fa = args[0], args[1]
    source = args[2] if len(args) == 3 else "-"
    body_md = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8")
    if body_md.strip() == "":
        print("بدنه‌ی خالی صف نمی‌شود", file=sys.stderr)
        raise SystemExit(2)
    try:
        asyncio.run(_run_enqueue(slug, title_fa, body_md))
    except (SlugError, DraftRejected) as exc:
        print(f"رد شد: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
