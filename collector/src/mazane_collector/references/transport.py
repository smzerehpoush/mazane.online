"""ترابرد مراجع — دو فعل کوچک؛ در تست‌ها فیک فیکسچری همین قرارداد می‌آید.

مراجع برخلاف سکوها فقط «GET یک JSON» نیستند: بن‌بست اول HTML می‌گیرد و بعد
فرم POST می‌کند (با همان کوکی‌ها). پس قرارداد دو متد متنی است و پیاده‌سازی
واقعی همان `httpx.AsyncClient` مشترک گردآورنده را (با User-Agent صادق و
cookie jar خودش) قرض می‌گیرد — کرال مؤدب، قاعده‌ی ۶ قراردادها.
"""

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


class RobotsCheckedTransport:
    """ترابرد مرجع پشت داوری `robots.txt` — مسیر ممنوع ⟸ کهنگی همان مرجع.

    هم GET و هم POST داوری می‌شوند: گردش بن‌بست (`GET /` سپس `POST /json`)
    تماماً کرال است و بسته شدن هر مرحله در robots یعنی همان مرحله ممنوع؛
    داوری پیش از ارسال است تا درخواست ممنوع هرگز بیرون نرود.
    """

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
