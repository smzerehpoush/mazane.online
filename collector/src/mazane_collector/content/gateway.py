"""سطح تماس کمینه‌ی خط لوله‌ی محتوا با جدول `posts` (مهاجرت 010_blog.sql).

عمداً از پروتکل Store سکوها جداست: صف محتوا فقط با جدول `posts` کار دارد و
نباید سطح تماس قیمت‌ها را پهن کند. منطق (queue / publisher / retract) روی
همین اینترفیس تزریقی سوار است تا تست مرز گردآورنده با فیک درون‌حافظه‌ای و
بدون پستگرس زنده سبز شود — همان الگوی `RetentionStore` در retention.py.

قراردادهای جدول که این ماژول به آن‌ها تکیه می‌کند (010_blog.sql):
- `draft` هرگز published_at ندارد؛ هر پستِ گذشته از پیش‌نویس دارد و
  پس‌گیری آن را نگه می‌دارد (سند «کی منتشر شد» پاک نمی‌شود).
- `updated_at` فقط با تغییر معنادار عوض می‌شود — منبع lastmod سایت‌مپ.
  برای پیش‌نویس یعنی «زمان صف شدن / آخرین ویرایش» ⟸ ترتیب «قدیمی‌ترین
  پیش‌نویس» همین ستون است (ویرایشِ پیش‌نویس آن را به ته صف می‌برد — عمدی:
  محتوای ویرایش‌شده تازه‌ترین است).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict


class PostRow(BaseModel):
    """نمای یک ردیف `posts` برای منطق صف/انتشار/پس‌گیری."""

    model_config = ConfigDict(frozen=True)

    slug: str
    title_fa: str
    body_md: str
    status: str  # draft | published | retracted — همان check جدول
    published_at: datetime | None
    updated_at: datetime


class ContentGateway(Protocol):
    """پستگرس واقعی (`PostgresContentGateway`) یا فیک درون‌حافظه‌ای تست."""

    async def insert_draft(
        self, slug: str, title_fa: str, body_md: str, *, now: datetime
    ) -> None:
        """درج پیش‌نویس با `updated_at = now` — فقط از مسیر `enqueue_draft`."""
        ...

    async def all_slugs(self) -> frozenset[str]:
        """همه‌ی اسلاگ‌های جدول (هر وضعیتی) — دروازه‌ی برخورد در صف شدن."""
        ...

    async def existing_texts(self) -> tuple[tuple[str, str], ...]:
        """زوج‌های `(slug, body_md)` همه‌ی ردیف‌ها (هر وضعیتی) — ورودی چک
        شباهت دروازه (بلیت ۱۴): پیش‌نویسِ در صف هم «پست موجود» است (مولد
        نباید یک مطلب را دوبار صف کند) و پس‌گرفته هم (مطلب پس‌گرفته نباید
        با تغییر جزئی برگردد)."""
        ...

    async def draft_count(self) -> int:
        """شمار پیش‌نویس‌های منتظر — صورتِ کسرِ عمق صف."""
        ...

    async def published_count_since(self, since: datetime) -> int:
        """شمار پست‌های بیرون‌رفته با `published_at >= since` — شمارنده‌ی سقف
        روزانه. پس‌گرفته‌ها هم می‌شمارند: سقفْ نرخ خروجی سرور است و پس‌گیری
        سهم مصرف‌شده را پس نمی‌دهد."""
        ...

    async def oldest_drafts(self, limit: int) -> tuple[PostRow, ...]:
        """قدیمی‌ترین پیش‌نویس‌ها (updated_at و سپس slug، صعودی)."""
        ...

    async def get_post(self, slug: str) -> PostRow | None: ...

    async def set_published(self, slug: str, *, published_at: datetime) -> None:
        """draft ⟸ published؛ `published_at = updated_at = لحظه‌ی انتشار`
        (انتشار تغییر معنادار است — lastmod سایت‌مپ)."""
        ...

    async def set_retracted(self, slug: str, *, now: datetime) -> None:
        """published ⟸ retracted؛ `updated_at = now` و published_at دست‌نخورده."""
        ...


_INSERT_DRAFT = """
insert into posts (slug, title_fa, body_md, status, published_at, updated_at)
values ($1, $2, $3, 'draft', null, $4)
"""

_SELECT_ALL_SLUGS = "select slug from posts"

_SELECT_ALL_TEXTS = "select slug, body_md from posts"

_COUNT_DRAFTS = "select count(*) as n from posts where status = 'draft'"

_COUNT_PUBLISHED_SINCE = """
select count(*) as n from posts
where published_at is not null and published_at >= $1
"""

_SELECT_OLDEST_DRAFTS = """
select slug, title_fa, body_md, status, published_at, updated_at
from posts
where status = 'draft'
order by updated_at, slug
limit $1
"""

_SELECT_POST = """
select slug, title_fa, body_md, status, published_at, updated_at
from posts where slug = $1
"""

_SET_PUBLISHED = """
update posts
set status = 'published', published_at = $2, updated_at = $2
where slug = $1 and status = 'draft'
"""

_SET_RETRACTED = """
update posts
set status = 'retracted', updated_at = $2
where slug = $1 and status = 'published'
"""


def _row_to_post(row: Any) -> PostRow:
    return PostRow(
        slug=row["slug"],
        title_fa=row["title_fa"],
        body_md=row["body_md"],
        status=row["status"],
        published_at=row["published_at"],
        updated_at=row["updated_at"],
    )


class PostgresContentGateway:
    """پیاده‌سازی واقعی روی asyncpg — شرط‌های وضعیت در خود SQL هم هستند تا
    مسابقه‌ی دو اجرای هم‌زمان (دو گذر حلقه، یا فرمان دستی) ردیف را دوبار
    جابه‌جا نکند؛ قید کلید اصلی جدول هم آخرین خط دفاع درجِ تکراری است."""

    def __init__(self, pool: Any) -> None:
        """`pool` یک `asyncpg.Pool` است (تزریقی، برای تست‌پذیری)."""
        self._pool = pool

    async def insert_draft(
        self, slug: str, title_fa: str, body_md: str, *, now: datetime
    ) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(_INSERT_DRAFT, slug, title_fa, body_md, now)

    async def all_slugs(self) -> frozenset[str]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(_SELECT_ALL_SLUGS)
        return frozenset(row["slug"] for row in rows)

    async def existing_texts(self) -> tuple[tuple[str, str], ...]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(_SELECT_ALL_TEXTS)
        return tuple((row["slug"], row["body_md"]) for row in rows)

    async def draft_count(self) -> int:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(_COUNT_DRAFTS)
        return int(row["n"])

    async def published_count_since(self, since: datetime) -> int:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(_COUNT_PUBLISHED_SINCE, since)
        return int(row["n"])

    async def oldest_drafts(self, limit: int) -> tuple[PostRow, ...]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(_SELECT_OLDEST_DRAFTS, limit)
        return tuple(_row_to_post(row) for row in rows)

    async def get_post(self, slug: str) -> PostRow | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(_SELECT_POST, slug)
        return None if row is None else _row_to_post(row)

    async def set_published(self, slug: str, *, published_at: datetime) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(_SET_PUBLISHED, slug, published_at)

    async def set_retracted(self, slug: str, *, now: datetime) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(_SET_RETRACTED, slug, now)
