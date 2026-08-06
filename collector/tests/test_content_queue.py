"""مرز گردآورنده — صف پیش‌نویس، سقف انتشار روزانه و پس‌گیری (بلیت ۱۳).

منطق محتوا روی اینترفیس کوچک `ContentGateway` سوار است (الگوی retention)؛
اینجا فیک درون‌حافظه‌ای همان اینترفیس + ضبط‌کننده‌ی فراخوانی بازتولید وب
جای پستگرس و HTTP واقعی می‌نشینند — هیچ تماس شبکه‌ای و سرویس زنده‌ای نیست.

معیارهای پذیرش بلیت:
- با ۲۰ پیش‌نویس و سقف ۲، در روز فقط ۲ پست منتشر می‌شود (روز بعد ۲ تای بعدی).
- عمق صف زیر آستانه (۵ روز) هشدار WARNING تولید می‌کند.
- پس‌گیری وضعیت را retracted می‌کند و بازتولید وب (فهرست + پست + سایت‌مپ)
  را صدا می‌زند — noindex از راه 404 + حذف از سایت‌مپ (مستند در retract.py).
"""

from datetime import UTC, datetime, timedelta
import logging

import pytest

from mazane_collector.content.gateway import ContentGateway, PostRow
from mazane_collector.content.publisher import drain_pass, publish_due
from mazane_collector.content.queue import (
    QUEUE_ALERT_DAYS,
    check_queue_depth,
    enqueue_draft,
)
from mazane_collector.content.retract import RetractOutcome, retract_post
from mazane_collector.slugs import (
    InvalidSlugError,
    ReservedSlugError,
    SlugCollisionError,
)

# ساعت ۰۹:۳۰ یک روز دلخواه — همه‌ی زمان‌ها تزریقی‌اند، ساعت سیستم بی‌اثر است.
BASE = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)
NEXT_DAY = BASE + timedelta(days=1)


class FakeContentGateway:
    """فیک درون‌حافظه‌ای `ContentGateway` — همان قراردادهای جدول posts."""

    def __init__(self) -> None:
        self.posts: dict[str, PostRow] = {}

    async def insert_draft(
        self, slug: str, title_fa: str, body_md: str, *, now: datetime
    ) -> None:
        assert slug not in self.posts  # قید کلید اصلی جدول
        self.posts[slug] = PostRow(
            slug=slug,
            title_fa=title_fa,
            body_md=body_md,
            status="draft",
            published_at=None,
            updated_at=now,
        )

    async def all_slugs(self) -> frozenset[str]:
        return frozenset(self.posts)

    async def draft_count(self) -> int:
        return sum(1 for p in self.posts.values() if p.status == "draft")

    async def published_count_since(self, since: datetime) -> int:
        return sum(
            1
            for p in self.posts.values()
            if p.published_at is not None and p.published_at >= since
        )

    async def oldest_drafts(self, limit: int) -> tuple[PostRow, ...]:
        drafts = sorted(
            (p for p in self.posts.values() if p.status == "draft"),
            key=lambda p: (p.updated_at, p.slug),
        )
        return tuple(drafts[:limit])

    async def get_post(self, slug: str) -> PostRow | None:
        return self.posts.get(slug)

    async def set_published(self, slug: str, *, published_at: datetime) -> None:
        post = self.posts[slug]
        assert post.status == "draft"
        self.posts[slug] = post.model_copy(
            update={
                "status": "published",
                "published_at": published_at,
                "updated_at": published_at,
            }
        )

    async def set_retracted(self, slug: str, *, now: datetime) -> None:
        post = self.posts[slug]
        assert post.status == "published"  # قید check جدول: پس‌گرفته published_at دارد
        self.posts[slug] = post.model_copy(update={"status": "retracted", "updated_at": now})


# تایید ایستا: فیک همان اینترفیس تزریقی است.
_GATEWAY_CONFORMANCE: ContentGateway = FakeContentGateway()


class RecordingRevalidator:
    """ضبط‌کننده‌ی فراخوانی‌های بازتولید وب — جای POST واقعی به /api/revalidate-blog."""

    def __init__(self, *, result: bool = True, exc: Exception | None = None) -> None:
        self.calls: list[str | None] = []
        self._result = result
        self._exc = exc

    async def __call__(self, slug: str | None = None) -> bool:
        self.calls.append(slug)
        if self._exc is not None:
            raise self._exc
        return self._result


async def seed_drafts(gateway: FakeContentGateway, count: int) -> list[str]:
    """پیش‌نویس‌ها به ترتیب زمانی (یک دقیقه فاصله) — «قدیمی‌ترین» تعریف‌پذیر است."""
    slugs = []
    for i in range(count):
        slug = f"post-{i:02d}"
        await enqueue_draft(
            gateway,
            slug=slug,
            title_fa=f"پست {i}",
            body_md="متن آزمایشی",
            now=BASE - timedelta(days=1) + timedelta(minutes=i),
        )
        slugs.append(slug)
    return slugs


# ------------------------------------------------------------------ سقف روزانه


async def test_cap_limits_publishes_to_two_per_day_with_twenty_drafts() -> None:
    """معیار پذیرش: ۲۰ پیش‌نویس، سقف ۲ ⟸ امروز فقط ۲؛ فردا ۲ تای بعدی."""
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 20)

    published = await publish_due(gateway, revalidate, now=BASE, daily_cap=2)
    assert published == ("post-00", "post-01")

    # گذرهای بعدیِ همان روز — مستقل از اینکه ۱۸ پیش‌نویس منتظرند — هیچ.
    assert await publish_due(gateway, revalidate, now=BASE + timedelta(minutes=15), daily_cap=2) == ()
    assert await publish_due(gateway, revalidate, now=BASE + timedelta(hours=10), daily_cap=2) == ()

    # روز بعد: دو تای بعدیِ صف، به همان ترتیب.
    assert await publish_due(gateway, revalidate, now=NEXT_DAY, daily_cap=2) == (
        "post-02",
        "post-03",
    )
    assert await gateway.draft_count() == 16


async def test_publish_picks_oldest_drafts_first() -> None:
    gateway = FakeContentGateway()
    # عمداً با ترتیب درج به‌هم‌ریخته — ملاک updated_at (زمان صف شدن) است.
    for slug, minutes in (("newest", 30), ("oldest", 0), ("middle", 10)):
        await enqueue_draft(
            gateway,
            slug=slug,
            title_fa=slug,
            body_md="متن",
            now=BASE - timedelta(hours=1) + timedelta(minutes=minutes),
        )

    published = await publish_due(gateway, RecordingRevalidator(), now=BASE, daily_cap=2)

    assert published == ("oldest", "middle")


async def test_already_published_today_counts_against_cap() -> None:
    """سقف سمت سرور روی «انتشارهای امروز» است، نه روی هر گذر جدا."""
    gateway = FakeContentGateway()
    await seed_drafts(gateway, 5)
    # یک پست صبحِ امروز (پیش از این گذر) منتشر شده است.
    await gateway.set_published("post-00", published_at=BASE - timedelta(hours=2))

    published = await publish_due(gateway, RecordingRevalidator(), now=BASE, daily_cap=2)

    assert published == ("post-01",)  # فقط ۱ = ۲ − ۱


async def test_retraction_does_not_refund_todays_budget() -> None:
    """پس‌گیریِ انتشارِ امروز، سهم امروز را آزاد نمی‌کند — سقف نرخ خروجی
    سرور است («چند پست امروز بیرون رفت»)، نه شمار پست‌های زنده."""
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 5)
    await publish_due(gateway, revalidate, now=BASE, daily_cap=2)
    await retract_post(gateway, revalidate, "post-00", now=BASE + timedelta(hours=1))

    published = await publish_due(
        gateway, revalidate, now=BASE + timedelta(hours=2), daily_cap=2
    )

    assert published == ()


async def test_published_at_is_publish_moment_not_enqueue_moment() -> None:
    gateway = FakeContentGateway()
    await seed_drafts(gateway, 1)

    await publish_due(gateway, RecordingRevalidator(), now=BASE, daily_cap=2)

    post = await gateway.get_post("post-00")
    assert post is not None
    assert post.status == "published"
    assert post.published_at == BASE
    assert post.updated_at == BASE  # انتشار تغییر معنادار است — منبع lastmod سایت‌مپ


# ------------------------------------------------------------- بازتولید وب


async def test_publish_fires_revalidation_per_published_slug() -> None:
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 3)

    await publish_due(gateway, revalidate, now=BASE, daily_cap=2)

    assert revalidate.calls == ["post-00", "post-01"]


async def test_revalidation_failure_does_not_roll_back_publish(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """بازتولید بهینه‌سازی تازگی است، نه شرط انتشار: شکستش فقط WARNING است
    و ISR وب در بازتولید بعدی جبران می‌کند (مستند در publisher.py)."""
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator(exc=RuntimeError("وب در دسترس نیست"))
    await seed_drafts(gateway, 2)

    with caplog.at_level(logging.WARNING, logger="mazane.collector.content"):
        published = await publish_due(gateway, revalidate, now=BASE, daily_cap=2)

    assert published == ("post-00", "post-01")
    for slug in published:
        post = await gateway.get_post(slug)
        assert post is not None and post.status == "published"
    assert any("بازتولید" in record.message for record in caplog.records)


# ------------------------------------------------------------------ عمق صف


async def test_queue_depth_below_five_days_logs_warning(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """معیار پذیرش: عمق صف زیر آستانه هشدار تولید می‌کند.

    قلاب هشدار فعلاً همین لاگ WARNING است (مستند در queue.py) — پایش لاگ
    سرور آن را می‌بیند."""
    gateway = FakeContentGateway()
    await seed_drafts(gateway, 8)  # ‏۸ ÷ ۲ = ۴ روز < ۵

    with caplog.at_level(logging.WARNING, logger="mazane.collector.content"):
        depth = await check_queue_depth(gateway, daily_cap=2)

    assert depth.drafts == 8
    assert depth.days == 4.0
    assert any(record.levelno == logging.WARNING for record in caplog.records)


async def test_queue_depth_at_or_above_threshold_is_quiet(
    caplog: pytest.LogCaptureFixture,
) -> None:
    gateway = FakeContentGateway()
    await seed_drafts(gateway, 10)  # ‏۱۰ ÷ ۲ = ۵ روز — «زیر ۵» نیست

    with caplog.at_level(logging.WARNING, logger="mazane.collector.content"):
        depth = await check_queue_depth(gateway, daily_cap=2)

    assert depth.days == QUEUE_ALERT_DAYS == 5
    assert not caplog.records


async def test_drain_pass_publishes_then_reports_depth() -> None:
    """گذر حلقه‌ی سرور: انتشارِ سررسید + سنجش عمق در یک گذر."""
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 6)

    published, depth = await drain_pass(gateway, revalidate, now=BASE, daily_cap=2)

    assert published == ("post-00", "post-01")
    assert depth.drafts == 4  # پس از انتشار سنجیده می‌شود — عمقِ واقعیِ باقی‌مانده
    assert depth.days == 2.0


# ------------------------------------------------------------------ پس‌گیری


async def test_retract_flips_status_and_fires_revalidation() -> None:
    """معیار پذیرش: فرمان پس‌گیری پست را noindex می‌کند و از سایت‌مپ درمی‌آورد —
    وضعیت retracted ⟸ وب 404 می‌دهد و از فهرست/سایت‌مپ حذف می‌کند؛ فراخوانی
    بازتولید با اسلاگ، ‎/blog‎ و ‎/blog/<slug>‎ و ‎/sitemap.xml‎ را می‌سازد."""
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 1)
    await gateway.set_published("post-00", published_at=BASE - timedelta(days=3))
    retract_at = BASE + timedelta(hours=1)

    outcome = await retract_post(gateway, revalidate, "post-00", now=retract_at)

    assert outcome is RetractOutcome.RETRACTED
    post = await gateway.get_post("post-00")
    assert post is not None
    assert post.status == "retracted"
    assert post.published_at == BASE - timedelta(days=3)  # سند تاریخ انتشار می‌ماند
    assert post.updated_at == retract_at  # تغییر معنادار ⟸ lastmod سایت‌مپ
    assert revalidate.calls == ["post-00"]


async def test_retract_unknown_slug_reports_not_found() -> None:
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()

    outcome = await retract_post(gateway, revalidate, "nist", now=BASE)

    assert outcome is RetractOutcome.NOT_FOUND
    assert revalidate.calls == []


async def test_retract_draft_is_refused() -> None:
    """پیش‌نویس منتشر نشده که پس گرفته شود — نامرئی است؛ وضعیتش دست نمی‌خورد
    (قید جدول هم پس‌گرفته‌ی بدون published_at را نمی‌پذیرد)."""
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 1)

    outcome = await retract_post(gateway, revalidate, "post-00", now=BASE)

    assert outcome is RetractOutcome.NOT_PUBLISHED
    post = await gateway.get_post("post-00")
    assert post is not None and post.status == "draft"
    assert revalidate.calls == []


async def test_retract_is_idempotent_and_refires_revalidation() -> None:
    """اجرای دوباره خطا نیست: وضعیت همان می‌ماند ولی بازتولید دوباره شلیک
    می‌شود — اگر بار اول بازتولید شکسته باشد، اجرای دوم جبرانش می‌کند."""
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 1)
    await gateway.set_published("post-00", published_at=BASE)
    await retract_post(gateway, revalidate, "post-00", now=BASE + timedelta(hours=1))

    outcome = await retract_post(gateway, revalidate, "post-00", now=BASE + timedelta(hours=2))

    assert outcome is RetractOutcome.ALREADY_RETRACTED
    post = await gateway.get_post("post-00")
    assert post is not None
    assert post.updated_at == BASE + timedelta(hours=1)  # اجرای دوم updated_at را نمی‌جنباند
    assert revalidate.calls == ["post-00", "post-00"]


# ------------------------------------------------------- دروازه‌ی اسلاگ صف


async def test_enqueue_rejects_reserved_slug() -> None:
    gateway = FakeContentGateway()

    with pytest.raises(ReservedSlugError):
        await enqueue_draft(gateway, slug="blog", title_fa="x", body_md="x", now=BASE)
    assert await gateway.all_slugs() == frozenset()


async def test_enqueue_rejects_collision_with_central_registry() -> None:
    """اسلاگ سکو/دارایی/صفحه‌ی ایستا در طرح URL تخت پست را می‌خورد — رد."""
    gateway = FakeContentGateway()

    with pytest.raises(SlugCollisionError):
        await enqueue_draft(gateway, slug="wallgold", title_fa="x", body_md="x", now=BASE)
    assert await gateway.all_slugs() == frozenset()


async def test_enqueue_rejects_non_flat_latin_slug() -> None:
    gateway = FakeContentGateway()

    with pytest.raises(InvalidSlugError):
        await enqueue_draft(gateway, slug="Tala_18", title_fa="x", body_md="x", now=BASE)
    assert await gateway.all_slugs() == frozenset()


async def test_enqueue_rejects_slug_already_in_posts_table() -> None:
    gateway = FakeContentGateway()
    await enqueue_draft(gateway, slug="moqayese-karmozd", title_fa="x", body_md="x", now=BASE)

    with pytest.raises(SlugCollisionError):
        await enqueue_draft(
            gateway, slug="moqayese-karmozd", title_fa="y", body_md="y", now=BASE
        )
    assert await gateway.draft_count() == 1


async def test_enqueue_accepts_valid_new_slug() -> None:
    gateway = FakeContentGateway()

    await enqueue_draft(
        gateway,
        slug="arzantarin-tala-18",
        title_fa="ارزان‌ترین طلای ۱۸ عیار",
        body_md="## متن",
        now=BASE,
    )

    post = await gateway.get_post("arzantarin-tala-18")
    assert post is not None
    assert post.status == "draft"
    assert post.published_at is None
    assert post.updated_at == BASE
