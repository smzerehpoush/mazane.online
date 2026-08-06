"""پس‌گیری تک‌فرمانی — `mazane-retract <slug>` (بند ۱۳، تصمیم ۱۶).

معیار پذیرش بلیت: «فرمان پس‌گیری پست را noindex می‌کند و از سایت‌مپ
درمی‌آورد». چطور برآورده می‌شود: این فرمان `status='retracted'` می‌کند و
`updated_at` را می‌جنباند؛ وب (بلیت ۱۲) پستِ پس‌گرفته را **404** می‌دهد و
از فهرست ‎/blog‎ و ‎/sitemap.xml‎ حذف می‌کند — 404 + حذف از سایت‌مپ یعنی
خروج از ایندکس؛ تگ `noindex` جدا لازم نیست چون صفحه‌ای باقی نمی‌ماند که تگ
بگیرد. بعدش فراخوان بازتولید با اسلاگ، هر سه مسیر (‎/blog‎، ‎/blog/<slug>‎،
‎/sitemap.xml‎) را در همان لحظه بازمی‌سازد تا بدون دیپلوی منعکس شود.

`published_at` دست نمی‌خورد: سند «کی منتشر شده بود» بخشی از آرشیو است.
اجرای دوباره خطا نیست (idempotent) و بازتولید را دوباره شلیک می‌کند —
اگر بار اول بازتولید شکسته باشد، اجرای دوم جبران می‌کند.
"""

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
    """نتیجه‌ی پس‌گیری — برای پیام فرمان و تست مرزی."""

    RETRACTED = "RETRACTED"
    ALREADY_RETRACTED = "ALREADY_RETRACTED"
    NOT_PUBLISHED = "NOT_PUBLISHED"  # پیش‌نویس است — نامرئی است، چیزی برای پس‌گیری نیست
    NOT_FOUND = "NOT_FOUND"


async def retract_post(
    gateway: ContentGateway,
    revalidate: BlogRevalidator,
    slug: str,
    *,
    now: datetime | None = None,
) -> RetractOutcome:
    """پس‌گیری یک پست منتشرشده + بازتولید وب. سیاست‌ها سرِ ماژول."""
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
    import asyncpg  # فقط مسیر CLI — تست‌ها این پایین نمی‌آیند

    from .gateway import PostgresContentGateway
    from .revalidate import revalidator_from_env

    database_url = os.environ.get(
        "MAZANE_DATABASE_URL", "postgresql://mazane:mazane@127.0.0.1:5432/mazane"
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
    """نقطه‌ی ورود `mazane-retract` — یک آرگومان: اسلاگ پست."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    args = sys.argv[1:]
    if len(args) != 1:
        print("کاربرد: mazane-retract <slug>", file=sys.stderr)
        raise SystemExit(2)
    outcome = asyncio.run(_run_retract(args[0]))
    print(f"{args[0]}: {_MESSAGES[outcome]}")
    if outcome in (RetractOutcome.NOT_FOUND, RetractOutcome.NOT_PUBLISHED):
        raise SystemExit(1)
