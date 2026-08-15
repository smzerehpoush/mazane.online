"""
⚠️ The meaning of this call changed with the web's migration to TanStack Start
(2026-08-06): there is no longer any page cache at the origin — /blog,
/blog/<slug>, and /sitemap.xml each build their response directly from
Postgres. So "revalidate" has nothing left to invalidate, and the only
remaining delay is the ~60-second edge cache, which expires on its own.
The endpoint is kept on purpose (same 200/401/400) so this caller and its
tests don't break.
"""

from __future__ import annotations

import logging
import os
from typing import Protocol

import httpx

log = logging.getLogger("mazane.collector.content")

DEFAULT_REVALIDATE_URL = "http://127.0.0.1:3000/api/revalidate-blog"


class BlogRevalidator(Protocol):

    async def __call__(self, slug: str | None = None) -> bool: ...


class HttpRevalidator:

    def __init__(self, client: httpx.AsyncClient, *, url: str, token: str) -> None:
        self._client = client
        self._url = url
        self._token = token

    async def __call__(self, slug: str | None = None) -> bool:
        payload = {} if slug is None else {"slug": slug}
        try:
            response = await self._client.post(
                self._url,
                headers={"Authorization": f"Bearer {self._token}"},
                json=payload,
            )
            response.raise_for_status()
        except Exception as error:
            log.warning("web revalidate call (%s) failed: %s", self._url, error)
            return False
        return True


class _UnconfiguredRevalidator:

    async def __call__(self, slug: str | None = None) -> bool:
        log.warning(
            "TABLO_REVALIDATE_TOKEN is not set — web revalidate did not happen (slug=%s)", slug
        )
        return False


def revalidator_from_env(client: httpx.AsyncClient) -> BlogRevalidator:
    url = os.environ.get("TABLO_REVALIDATE_URL", DEFAULT_REVALIDATE_URL)
    token = os.environ.get("TABLO_REVALIDATE_TOKEN", "")
    if token == "":
        return _UnconfiguredRevalidator()
    return HttpRevalidator(client, url=url, token=token)
