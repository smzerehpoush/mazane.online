"""ناشر صف: انتشار سررسید با سقف روزانه‌ی سمت سرور (بند ۱۳، تصمیم‌های ۱۶–۱۷).

سرور صف را با آهنگ ثابت خالی می‌کند: حلقه‌ی main هر گذر (۱۵ دقیقه)
`publish_due` را صدا می‌زند و خودِ تابع تصمیم می‌گیرد امروز جا هست یا نه —
**مستقل از اینکه چند پیش‌نویس منتظر است** (دروازه‌ی تصمیم ۱۶: سقف سمت
سرور، نه سمت مولد). بودجه‌ی هر گذر:

    بودجه = سقف روزانه − انتشارهای همین روز (پس‌گرفته‌ها هم می‌شمارند)

«روز» = روز تقویمیِ ساعت تزریقی — در تولید UTC؛ مرز روز فقط شمارنده‌ی
سقف است، نه مفهوم نمایشی، پس ثبات از محلی بودن مهم‌تر است.

پس از هر انتشار، بازتولید ISR وب صدا زده می‌شود. **شکست بازتولیدْ انتشار
را برنمی‌گرداند** — عمدی: پست در پایگاه منتشر شده و منبع حقیقتْ همان است؛
بازتولید فقط کش وب را زودتر تازه می‌کند و ISR در بازتولید بعدیِ خودش
(revalidate صفحات بلاگ) به هر حال جبران می‌کند. برگرداندن انتشار به خاطر
یک خطای گذاری شبکه، صف را به لرزش می‌انداخت؛ WARNING کافی است.

سقف با `MAZANE_DAILY_PUBLISH_CAP` پیکربندی می‌شود (پیش‌فرض ۲).
"""

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime

from .gateway import ContentGateway
from .queue import QueueDepth, check_queue_depth
from .revalidate import BlogRevalidator

log = logging.getLogger("mazane.collector.content")

#: سقف پیش‌فرض انتشار روزانه — تصمیم ۱۷ (~۲ پست در روز؛ عمق هدف ۱۴ روز).
DEFAULT_DAILY_PUBLISH_CAP = 2


def daily_publish_cap_from_env() -> int:
    """خواندن سقف از env؛ مقدار نامعتبر ⟸ پیش‌فرض با WARNING (نه سقوط)."""
    raw = os.environ.get("MAZANE_DAILY_PUBLISH_CAP")
    if raw is None:
        return DEFAULT_DAILY_PUBLISH_CAP
    try:
        cap = int(raw)
        if cap < 1:
            raise ValueError(raw)
    except ValueError:
        log.warning(
            "MAZANE_DAILY_PUBLISH_CAP=%r نامعتبر است — پیش‌فرض %s",
            raw,
            DEFAULT_DAILY_PUBLISH_CAP,
        )
        return DEFAULT_DAILY_PUBLISH_CAP
    return cap


def day_start(moment: datetime) -> datetime:
    """آغاز روز تقویمیِ دربرگیرنده‌ی لحظه — پنجره‌ی شمارش سقف روزانه."""
    return moment.replace(hour=0, minute=0, second=0, microsecond=0)


async def publish_due(
    gateway: ContentGateway,
    revalidate: BlogRevalidator,
    *,
    now: datetime | None = None,
    daily_cap: int = DEFAULT_DAILY_PUBLISH_CAP,
) -> tuple[str, ...]:
    """انتشار قدیمی‌ترین پیش‌نویس‌ها تا سقفِ باقی‌مانده‌ی امروز.

    `published_at = updated_at = now` — لحظه‌ی واقعی انتشار، نه زمان صف شدن
    (updated_at منبع lastmod سایت‌مپ است و انتشار تغییر معنادار است).
    اسلاگ‌های منتشرشده را برمی‌گرداند.
    """
    moment = now if now is not None else datetime.now(UTC)
    already = await gateway.published_count_since(day_start(moment))
    budget = max(0, daily_cap - already)
    if budget == 0:
        return ()

    published: list[str] = []
    for draft in await gateway.oldest_drafts(budget):
        await gateway.set_published(draft.slug, published_at=moment)
        published.append(draft.slug)
        log.info("پست %s منتشر شد (%s از سقف %s امروز)", draft.slug, already + len(published), daily_cap)
        revalidated = False
        try:
            revalidated = await revalidate(draft.slug)
        except Exception:
            log.exception("فراخوان بازتولید وب برای %s استثنا داد", draft.slug)
        if not revalidated:
            # انتشار برنمی‌گردد (سرِ ماژول): ISR وب در گذر بعدی جبران می‌کند.
            log.warning("بازتولید وب برای %s نشد — ISR جبران می‌کند", draft.slug)
    return tuple(published)


async def drain_pass(
    gateway: ContentGateway,
    revalidate: BlogRevalidator,
    *,
    now: datetime | None = None,
    daily_cap: int = DEFAULT_DAILY_PUBLISH_CAP,
) -> tuple[tuple[str, ...], QueueDepth]:
    """یک گذر حلقه‌ی سرور: انتشار سررسید، سپس سنجش عمقِ باقی‌مانده‌ی صف
    (هشدار زیر آستانه داخل `check_queue_depth`)."""
    published = await publish_due(gateway, revalidate, now=now, daily_cap=daily_cap)
    depth = await check_queue_depth(gateway, daily_cap=daily_cap)
    return published, depth
