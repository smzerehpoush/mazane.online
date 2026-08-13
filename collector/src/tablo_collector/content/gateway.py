from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict


class PostRow(BaseModel):
    model_config = ConfigDict(frozen=True)

    slug: str
    title_fa: str
    body_md: str
    status: str
    published_at: datetime | None
    updated_at: datetime


class ContentGateway(Protocol):
    async def insert_draft(
        self, slug: str, title_fa: str, body_md: str, *, now: datetime
    ) -> None:
        ...

    async def all_slugs(self) -> frozenset[str]:
        ...

    async def existing_texts(self) -> tuple[tuple[str, str], ...]:
        ...

    async def draft_count(self) -> int:
        ...

    async def published_count_since(self, since: datetime) -> int:
        ...

    async def oldest_drafts(self, limit: int) -> tuple[PostRow, ...]:
        ...

    async def get_post(self, slug: str) -> PostRow | None: ...

    async def set_published(self, slug: str, *, published_at: datetime) -> None:
        ...

    async def set_retracted(self, slug: str, *, now: datetime) -> None:
        ...


_INSERT_DRAFT = """
insert into posts (slug, title_fa, body_md, status, published_at, updated_at)
values ($1, $2, $3, 'draft', null, $4)
"""

_SELECT_ALL_SLUGS = "select slug from posts"

# ⚠️ بدون فیلتر وضعیت: پیش‌نویس و پس‌گرفته هم «پست موجود»اند — مطلب
# پس‌گرفته نباید با تغییر جزئی برگردد.
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
    def __init__(self, pool: Any) -> None:
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
