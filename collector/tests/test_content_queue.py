from datetime import UTC, datetime, timedelta
import logging

import pytest

from tablo_collector.content.gateway import ContentGateway, PostRow
from tablo_collector.content.publisher import drain_pass, publish_due
from tablo_collector.content.queue import (
    QUEUE_ALERT_DAYS,
    check_queue_depth,
    enqueue_draft,
)
from tablo_collector.content.retract import RetractOutcome, retract_post
from tablo_collector.slugs import (
    InvalidSlugError,
    ReservedSlugError,
    SlugCollisionError,
)

BASE = datetime(2026, 8, 6, 9, 30, 0, tzinfo=UTC)
NEXT_DAY = BASE + timedelta(days=1)


class FakeContentGateway:
    def __init__(self) -> None:
        self.posts: dict[str, PostRow] = {}

    async def insert_draft(
        self, slug: str, title_fa: str, body_md: str, *, now: datetime
    ) -> None:
        assert slug not in self.posts
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

    async def existing_texts(self) -> tuple[tuple[str, str], ...]:
        return tuple((post.slug, post.body_md) for post in self.posts.values())

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
        assert post.status == "published"
        self.posts[slug] = post.model_copy(update={"status": "retracted", "updated_at": now})


_GATEWAY_CONFORMANCE: ContentGateway = FakeContentGateway()


class RecordingRevalidator:
    def __init__(self, *, result: bool = True, exc: Exception | None = None) -> None:
        self.calls: list[str | None] = []
        self._result = result
        self._exc = exc

    async def __call__(self, slug: str | None = None) -> bool:
        self.calls.append(slug)
        if self._exc is not None:
            raise self._exc
        return self._result


_LETTERS = "ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی"


def unique_body(index: int) -> str:
    word = _LETTERS[index] * 4
    return f"{word} {word} {word}"


async def seed_drafts(gateway: FakeContentGateway, count: int) -> list[str]:
    slugs = []
    for i in range(count):
        slug = f"post-{i:02d}"
        await enqueue_draft(
            gateway,
            slug=slug,
            title_template="پست {{shomare}}",
            body_template=unique_body(i),
            slots={"shomare": str(i)},
            now=BASE - timedelta(days=1) + timedelta(minutes=i),
        )
        slugs.append(slug)
    return slugs


async def test_cap_limits_publishes_to_two_per_day_with_twenty_drafts() -> None:
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 20)

    published = await publish_due(gateway, revalidate, now=BASE, daily_cap=2)
    assert published == ("post-00", "post-01")

    assert await publish_due(gateway, revalidate, now=BASE + timedelta(minutes=15), daily_cap=2) == ()
    assert await publish_due(gateway, revalidate, now=BASE + timedelta(hours=10), daily_cap=2) == ()

    assert await publish_due(gateway, revalidate, now=NEXT_DAY, daily_cap=2) == (
        "post-02",
        "post-03",
    )
    assert await gateway.draft_count() == 16


async def test_publish_picks_oldest_drafts_first() -> None:
    gateway = FakeContentGateway()
    for index, (slug, minutes) in enumerate((("newest", 30), ("oldest", 0), ("middle", 10))):
        await enqueue_draft(
            gateway,
            slug=slug,
            title_template=slug,
            body_template=unique_body(index),
            now=BASE - timedelta(hours=1) + timedelta(minutes=minutes),
        )

    published = await publish_due(gateway, RecordingRevalidator(), now=BASE, daily_cap=2)

    assert published == ("oldest", "middle")


async def test_already_published_today_counts_against_cap() -> None:
    gateway = FakeContentGateway()
    await seed_drafts(gateway, 5)
    await gateway.set_published("post-00", published_at=BASE - timedelta(hours=2))

    published = await publish_due(gateway, RecordingRevalidator(), now=BASE, daily_cap=2)

    assert published == ("post-01",)


async def test_retraction_does_not_refund_todays_budget() -> None:
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
    assert post.updated_at == BASE


async def test_publish_fires_revalidation_per_published_slug() -> None:
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 3)

    await publish_due(gateway, revalidate, now=BASE, daily_cap=2)

    assert revalidate.calls == ["post-00", "post-01"]


async def test_revalidation_failure_does_not_roll_back_publish(
    caplog: pytest.LogCaptureFixture,
) -> None:
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator(exc=RuntimeError("web is unavailable"))
    await seed_drafts(gateway, 2)

    with caplog.at_level(logging.WARNING, logger="mazane.collector.content"):
        published = await publish_due(gateway, revalidate, now=BASE, daily_cap=2)

    assert published == ("post-00", "post-01")
    for slug in published:
        post = await gateway.get_post(slug)
        assert post is not None and post.status == "published"
    assert any("revalidate" in record.message for record in caplog.records)


async def test_queue_depth_below_five_days_logs_warning(
    caplog: pytest.LogCaptureFixture,
) -> None:
    gateway = FakeContentGateway()
    await seed_drafts(gateway, 8)

    with caplog.at_level(logging.WARNING, logger="mazane.collector.content"):
        depth = await check_queue_depth(gateway, daily_cap=2)

    assert depth.drafts == 8
    assert depth.days == 4.0
    assert any(record.levelno == logging.WARNING for record in caplog.records)


async def test_queue_depth_at_or_above_threshold_is_quiet(
    caplog: pytest.LogCaptureFixture,
) -> None:
    gateway = FakeContentGateway()
    await seed_drafts(gateway, 10)

    with caplog.at_level(logging.WARNING, logger="mazane.collector.content"):
        depth = await check_queue_depth(gateway, daily_cap=2)

    assert depth.days == QUEUE_ALERT_DAYS == 5
    assert not caplog.records


async def test_drain_pass_publishes_then_reports_depth() -> None:
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 6)

    published, depth = await drain_pass(gateway, revalidate, now=BASE, daily_cap=2)

    assert published == ("post-00", "post-01")
    assert depth.drafts == 4
    assert depth.days == 2.0


async def test_retract_flips_status_and_fires_revalidation() -> None:
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
    assert post.published_at == BASE - timedelta(days=3)
    assert post.updated_at == retract_at
    assert revalidate.calls == ["post-00"]


async def test_retract_unknown_slug_reports_not_found() -> None:
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()

    outcome = await retract_post(gateway, revalidate, "nist", now=BASE)

    assert outcome is RetractOutcome.NOT_FOUND
    assert revalidate.calls == []


async def test_retract_draft_is_refused() -> None:
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 1)

    outcome = await retract_post(gateway, revalidate, "post-00", now=BASE)

    assert outcome is RetractOutcome.NOT_PUBLISHED
    post = await gateway.get_post("post-00")
    assert post is not None and post.status == "draft"
    assert revalidate.calls == []


async def test_retract_is_idempotent_and_refires_revalidation() -> None:
    gateway = FakeContentGateway()
    revalidate = RecordingRevalidator()
    await seed_drafts(gateway, 1)
    await gateway.set_published("post-00", published_at=BASE)
    await retract_post(gateway, revalidate, "post-00", now=BASE + timedelta(hours=1))

    outcome = await retract_post(gateway, revalidate, "post-00", now=BASE + timedelta(hours=2))

    assert outcome is RetractOutcome.ALREADY_RETRACTED
    post = await gateway.get_post("post-00")
    assert post is not None
    assert post.updated_at == BASE + timedelta(hours=1)
    assert revalidate.calls == ["post-00", "post-00"]


async def test_enqueue_rejects_reserved_slug() -> None:
    gateway = FakeContentGateway()

    with pytest.raises(ReservedSlugError):
        await enqueue_draft(
            gateway, slug="blog", title_template="الف", body_template="الف", now=BASE
        )
    assert await gateway.all_slugs() == frozenset()


async def test_enqueue_rejects_collision_with_central_registry() -> None:
    gateway = FakeContentGateway()

    with pytest.raises(SlugCollisionError):
        await enqueue_draft(
            gateway, slug="wallgold", title_template="الف", body_template="الف", now=BASE
        )
    assert await gateway.all_slugs() == frozenset()


async def test_enqueue_rejects_non_flat_latin_slug() -> None:
    gateway = FakeContentGateway()

    with pytest.raises(InvalidSlugError):
        await enqueue_draft(
            gateway, slug="Tala_18", title_template="الف", body_template="الف", now=BASE
        )
    assert await gateway.all_slugs() == frozenset()


async def test_enqueue_rejects_slug_already_in_posts_table() -> None:
    gateway = FakeContentGateway()
    await enqueue_draft(
        gateway, slug="moqayese-karmozd", title_template="الف", body_template="الف", now=BASE
    )

    with pytest.raises(SlugCollisionError):
        await enqueue_draft(
            gateway, slug="moqayese-karmozd", title_template="ب", body_template="ب", now=BASE
        )
    assert await gateway.draft_count() == 1


async def test_enqueue_accepts_valid_new_slug() -> None:
    gateway = FakeContentGateway()

    await enqueue_draft(
        gateway,
        slug="arzantarin-tala-18",
        title_template="ارزان‌ترین طلای {{ayar}} عیار",
        body_template="## جمع‌بندی\n\nعیار {{ayar}} را همه‌ی سکوها عرضه می‌کنند.",
        slots={"ayar": "۱۸"},
        now=BASE,
    )

    post = await gateway.get_post("arzantarin-tala-18")
    assert post is not None
    assert post.status == "draft"
    assert post.published_at is None
    assert post.updated_at == BASE
    assert post.title_fa == "ارزان‌ترین طلای ۱۸ عیار"
    assert "عیار ۱۸" in post.body_md
    assert "{{" not in post.body_md
