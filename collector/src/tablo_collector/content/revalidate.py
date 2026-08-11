"""فراخوان بازتولید بلاگ وب — قرارداد مسیر `‎/api/revalidate-blog‎` لایه‌ی وب.

    POST $TABLO_REVALIDATE_URL
    Authorization: Bearer $TABLO_REVALIDATE_TOKEN
    {"slug": "<post-slug>"}      # با اسلاگ: ‎/blog‎ + ‎/blog/<slug>‎ + ‎/sitemap.xml‎
                                 # بدون آن: فقط فهرست و سایت‌مپ

⚠️ معنای این فراخوان با مهاجرت وب به تنکستک استارت (۲۰۲۶-۰۸-۰۶) عوض شد:
دیگر هیچ کش صفحه‌ای در مبدأ نیست — ‎/blog‎ و ‎/blog/<slug>‎ و ‎/sitemap.xml‎ هر
درخواست را مستقیم از پستگرس می‌سازند. پس «بازتولید» چیزی برای باطل‌کردن ندارد
و تنها تأخیر باقی‌مانده، کش ~۶۰ ثانیه‌ای لبه است که خودش منقضی می‌شود.
اندپوینت عمداً حفظ شده (همان ۲۰۰/۴۰۱/۴۰۰) تا این صدازننده و آزمون‌هایش نشکنند.

بازتولیدْ بهینه‌سازی تازگی است، نه شرط درستی: شکستش فقط False برمی‌گرداند
(با WARNING) و صدازننده هرگز به خاطرش انتشار/پس‌گیری را برنمی‌گرداند —
چرایش در publisher.py مستند است. با نبودِ کش مبدأ، این «بی‌اهمیت بودنِ شکست»
از قبل هم بی‌خطرتر شده است.
"""

from __future__ import annotations

import logging
import os
from typing import Protocol

import httpx

log = logging.getLogger("mazane.collector.content")

#: وب روی همان سرور و پشت همان کدیِ لبه است (بند ۱۳، تصمیم ۵) — پیش‌فرض
#: کانتینر محلی؛ در محیط واقعی با TABLO_REVALIDATE_URL ست می‌شود.
DEFAULT_REVALIDATE_URL = "http://127.0.0.1:3000/api/revalidate-blog"


class BlogRevalidator(Protocol):
    """سطح تماس تزریقی — تست‌ها ضبط‌کننده‌ی فیک می‌گذارند، نه HTTP واقعی."""

    async def __call__(self, slug: str | None = None) -> bool: ...


class HttpRevalidator:
    """فراخوان واقعی با httpx — کلاینت تزریقی (همان کلاینت مشترک گردآورنده)."""

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
            log.warning("فراخوان بازتولید وب (%s) شکست: %s", self._url, error)
            return False
        return True


class _UnconfiguredRevalidator:
    """توکن ست نشده ⟸ فراخوانی بی‌فایده است (endpoint وب fail-closed با ۴۰۱
    است) — بدون تماس شبکه فقط هشدار می‌دهیم تا مشکل پیکربندی دیده شود."""

    async def __call__(self, slug: str | None = None) -> bool:
        log.warning(
            "TABLO_REVALIDATE_TOKEN ست نیست — بازتولید وب انجام نشد (slug=%s)", slug
        )
        return False


def revalidator_from_env(client: httpx.AsyncClient) -> BlogRevalidator:
    """ساخت فراخوان از env: TABLO_REVALIDATE_URL (+ توکن اجباری)."""
    url = os.environ.get("TABLO_REVALIDATE_URL", DEFAULT_REVALIDATE_URL)
    token = os.environ.get("TABLO_REVALIDATE_TOKEN", "")
    if token == "":
        return _UnconfiguredRevalidator()
    return HttpRevalidator(client, url=url, token=token)
