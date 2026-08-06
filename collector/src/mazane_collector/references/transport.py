"""ترابرد مراجع — دو فعل کوچک؛ در تست‌ها فیک فیکسچری همین قرارداد می‌آید.

مراجع برخلاف سکوها فقط «GET یک JSON» نیستند: بن‌بست اول HTML می‌گیرد و بعد
فرم POST می‌کند (با همان کوکی‌ها). پس قرارداد دو متد متنی است و پیاده‌سازی
واقعی همان `httpx.AsyncClient` مشترک گردآورنده را (با User-Agent صادق و
cookie jar خودش) قرض می‌گیرد — کرال مؤدب، قاعده‌ی ۶ قراردادها.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol


class ReferenceTransport(Protocol):
    async def get_text(
        self, url: str, *, headers: Mapping[str, str] | None = None
    ) -> str: ...

    async def post_form(
        self, url: str, data: Mapping[str, str], *, headers: Mapping[str, str] | None = None
    ) -> str: ...


class HttpxReferenceTransport:
    """پیاده‌سازی واقعی روی `httpx.AsyncClient` تزریقی (برای main)."""

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
