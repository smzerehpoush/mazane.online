from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol

from ..robots import RobotsDisallowed, RobotsGate


class ReferenceTransport(Protocol):
    async def get_text(
        self, url: str, *, headers: Mapping[str, str] | None = None
    ) -> str: ...

    async def post_form(
        self, url: str, data: Mapping[str, str], *, headers: Mapping[str, str] | None = None
    ) -> str: ...


class HttpxReferenceTransport:
    def __init__(self, client: Any) -> None:
        self._client = client

    async def get_text(self, url: str, *, headers: Mapping[str, str] | None = None) -> str:
        response = await self._client.get(url, headers=dict(headers or {}))
        response.raise_for_status()
        return str(response.text)

    async def post_form(
        self, url: str, data: Mapping[str, str], *, headers: Mapping[str, str] | None = None
    ) -> str:
        response = await self._client.post(url, data=dict(data), headers=dict(headers or {}))
        response.raise_for_status()
        return str(response.text)


class RobotsCheckedTransport:
    def __init__(self, gate: RobotsGate, inner: ReferenceTransport) -> None:
        self._gate = gate
        self._inner = inner

    async def get_text(self, url: str, *, headers: Mapping[str, str] | None = None) -> str:
        await self._require_allowed(url)
        return await self._inner.get_text(url, headers=headers)

    async def post_form(
        self, url: str, data: Mapping[str, str], *, headers: Mapping[str, str] | None = None
    ) -> str:
        await self._require_allowed(url)
        return await self._inner.post_form(url, data, headers=headers)

    async def _require_allowed(self, url: str) -> None:
        if not await self._gate.allows(url):
            raise RobotsDisallowed(url)
