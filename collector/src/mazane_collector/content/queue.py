"""صف پیش‌نویس: صف شدن با دروازه‌ی اسلاگ مرکزی + سنجش عمق صف (بلیت ۱۳).

عمق صف = پیش‌نویس‌های منتظر ÷ سقف انتشار روزانه ⟸ «چند روز دیگر مطلب
داریم». هدف ۱۴ روز و هشدار زیر ۵ روز (بند ۱۳، تصمیم ۱۷). **قلاب هشدار
فعلاً لاگ WARNING است** — پایش لاگ سرور همان را می‌بیند؛ اگر روزی کانال
هشدار جدا آمد، فقط همین یک جا عوض می‌شود.

دروازه‌ی اسلاگ: طرح URL تخت است (بند ۱۳، تصمیم ۱۱) ⟸ پست بلاگ نباید
اسلاگ سکو/دارایی/صفحه‌ی ایستا یا کلمه‌ی رزرو را بگیرد. `enqueue_draft`
اول `validate_new_slug` رجیستری مرکزی را صدا می‌زند (قالب/رزرو/برخورد با
کدِ سایت) و بعد برخورد با پست‌های موجود جدول را رد می‌کند — پیش از درج،
با همان خانواده‌ی استثناهای `slugs.py`.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import NamedTuple

from ..slugs import PUBLIC_SLUGS, SlugCollisionError
from .gateway import ContentGateway

log = logging.getLogger("mazane.collector.content")

#: عمق هدف صف — مولد باید تا این اندازه جلو بنویسد (تصمیم ۱۷).
QUEUE_TARGET_DAYS = 14
#: آستانه‌ی هشدار — زیر این، WARNING (قلاب هشدار فعلی).
QUEUE_ALERT_DAYS = 5


class QueueDepth(NamedTuple):
    """گزارش عمق صف برای لاگ حلقه و تست مرزی."""

    drafts: int
    daily_cap: int
    days: float


async def enqueue_draft(
    gateway: ContentGateway,
    *,
    slug: str,
    title_fa: str,
    body_md: str,
    now: datetime | None = None,
) -> None:
    """صف کردن یک پیش‌نویس — دروازه‌ی اسلاگ قبل از درج.

    خطاها همان خانواده‌ی `SlugError` رجیستری مرکزی‌اند: قالب غیر تخت ⟸
    `InvalidSlugError`، کلمه‌ی رزرو ⟸ `ReservedSlugError`، برخورد با
    سکو/دارایی/صفحه یا پستِ موجود ⟸ `SlugCollisionError`. رد یعنی استثنا —
    چیزی درج نمی‌شود.
    """
    PUBLIC_SLUGS.validate_new_slug(slug)
    if slug in await gateway.all_slugs():
        raise SlugCollisionError(
            f"اسلاگ {slug!r} قبلاً در جدول posts هست — قید یکتایی (تصمیم ۱۱)"
        )
    moment = now if now is not None else datetime.now(UTC)
    await gateway.insert_draft(slug, title_fa, body_md, now=moment)
    log.info("پیش‌نویس %s صف شد", slug)


async def check_queue_depth(gateway: ContentGateway, *, daily_cap: int) -> QueueDepth:
    """سنجش عمق صف؛ زیر آستانه (۵ روز) هشدار WARNING — قلاب هشدار فعلی."""
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


# ------------------------------------------------------------------ فرمان CLI


async def _run_enqueue(slug: str, title_fa: str, body_md: str) -> None:
    import asyncpg  # فقط مسیر CLI — تست‌ها این پایین نمی‌آیند

    from .gateway import PostgresContentGateway

    # رد سریع اسلاگ خراب/رزرو/برخوردی، پیش از باز کردن اتصال پایگاه.
    PUBLIC_SLUGS.validate_new_slug(slug)
    database_url = os.environ.get(
        "MAZANE_DATABASE_URL", "postgresql://mazane:mazane@127.0.0.1:5432/mazane"
    )
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=1)
    assert pool is not None
    try:
        await enqueue_draft(
            PostgresContentGateway(pool), slug=slug, title_fa=title_fa, body_md=body_md
        )
    finally:
        await pool.close()


def main() -> None:
    """`mazane-enqueue <slug> <title_fa> [body.md|-]` — صف کردن دستی پیش‌نویس.

    بدنه از فایل مارک‌داون یا stdin (`-`، پیش‌فرض) می‌آید. مولد محتوای
    ماشین محلی (تصمیم ۱۷) از همین مسیر صف سرور را پر می‌کند.
    """
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    args = sys.argv[1:]
    if len(args) not in (2, 3):
        print("کاربرد: mazane-enqueue <slug> <title_fa> [body.md|-]", file=sys.stderr)
        raise SystemExit(2)
    slug, title_fa = args[0], args[1]
    source = args[2] if len(args) == 3 else "-"
    body_md = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8")
    if body_md.strip() == "":
        print("بدنه‌ی خالی صف نمی‌شود", file=sys.stderr)
        raise SystemExit(2)
    asyncio.run(_run_enqueue(slug, title_fa, body_md))
