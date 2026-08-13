from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import UTC, datetime
from enum import StrEnum

import httpx

from .gateway import ContentGateway
from .revalidate import BlogRevalidator

log = logging.getLogger("mazane.collector.content")


class RetractOutcome(StrEnum):

    RETRACTED = "RETRACTED"
    ALREADY_RETRACTED = "ALREADY_RETRACTED"
    NOT_PUBLISHED = "NOT_PUBLISHED"
    NOT_FOUND = "NOT_FOUND"


async def retract_post(
    gateway: ContentGateway,
    revalidate: BlogRevalidator,
    slug: str,
    *,
    now: datetime | None = None,
) -> RetractOutcome:
    post = await gateway.get_post(slug)
    if post is None:
        return RetractOutcome.NOT_FOUND
    if post.status == "draft":
        return RetractOutcome.NOT_PUBLISHED
    if post.status == "published":
        moment = now if now is not None else datetime.now(UTC)
        await gateway.set_retracted(slug, now=moment)
        outcome = RetractOutcome.RETRACTED
        log.info("پست %s پس گرفته شد", slug)
    else:
        outcome = RetractOutcome.ALREADY_RETRACTED
    revalidated = False
    try:
        revalidated = await revalidate(slug)
    except Exception:
        log.exception("فراخوان بازتولید وب برای پس‌گیری %s استثنا داد", slug)
    if not revalidated:
        log.warning("بازتولید وب برای پس‌گیری %s نشد — دوباره اجرا کنید یا صبر کنید تا ISR برسد", slug)
    return outcome


_MESSAGES = {
    RetractOutcome.RETRACTED: "پس گرفته شد: 404 + حذف از فهرست و سایت‌مپ",
    RetractOutcome.ALREADY_RETRACTED: "قبلاً پس گرفته شده بود — بازتولید دوباره شلیک شد",
    RetractOutcome.NOT_PUBLISHED: "این اسلاگ هنوز پیش‌نویس است — چیزی منتشر نشده که پس گرفته شود",
    RetractOutcome.NOT_FOUND: "چنین پستی در جدول posts نیست",
}


async def _run_retract(slug: str) -> RetractOutcome:
    import asyncpg

    from .gateway import PostgresContentGateway
    from .revalidate import revalidator_from_env

    database_url = os.environ.get(
        "TABLO_DATABASE_URL", "postgresql://mazane:mazane@127.0.0.1:5432/mazane"
    )
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=1)
    assert pool is not None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            return await retract_post(
                PostgresContentGateway(pool), revalidator_from_env(client), slug
            )
    finally:
        await pool.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    args = sys.argv[1:]
    if len(args) != 1:
        print("کاربرد: tablo-retract <slug>", file=sys.stderr)
        raise SystemExit(2)
    outcome = asyncio.run(_run_retract(args[0]))
    print(f"{args[0]}: {_MESSAGES[outcome]}")
    if outcome in (RetractOutcome.NOT_FOUND, RetractOutcome.NOT_PUBLISHED):
        raise SystemExit(1)
