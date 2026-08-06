"""داوری `robots.txt` در زمان اجرا — قاعده‌ی ۶ قراردادها، این‌بار نه فقط در طراحی.

اندپوینت‌ها در زمان طراحی بررسی شده‌اند (سند تحقیق ۰۱)، ولی `robots.txt`
سند زنده است: هر میزبان می‌تواند فردا مسیری را ببندد — به‌ویژه برای اسکریپر
HTML بن‌بست که تنها منبع «صفحه‌خوان» ماست. این ماژول پیش از هر fetch
حلقه‌های سکو و مرجع، مسیر URL را با `robots.txt` همان میزبان می‌سنجد
(`urllib.robotparser` استاندارد؛ توکن UA همان MazaneBot صادق).

سیاست‌ها — همه در راستای «قطع منبع کهنگی است، نه خطا» (قاعده‌ی ۵):

- **کش هر میزبان با TTL ~۲۴ ساعت.** خواندن `robots.txt` خودش کرال است و
  باید مؤدب بماند؛ یک‌بار در روز برای هر میزبان کافی است. بهای آن این است
  که ممنوعیت تازه حداکثر یک TTL دیرتر دیده می‌شود — پذیرفته و مستند.
- **پاسخ ۴xx (از جمله ۴۰۴):** `robots.txt` ندارد ⟸ همه‌چیز مجاز
  (عرف RFC 9309: «unavailable» یعنی دسترسی آزاد).
- **پاسخ ۵xx یا خطای شبکه: باز-به-شکست (fail-open) با هشدار در لاگ.**
  تصمیم مستند این بلیت: قطعیِ خود `robots.txt` نباید گردآوری اندپوینت‌هایی
  را که در زمان طراحی بررسی و تأیید شده‌اند متوقف کند — وگرنه یک خطای
  گذرای میزبان، همه‌ی صفحه‌ها را یک‌جا کهنه می‌کند. اگر میزبانی واقعاً
  مسیری را بسته باشد، در نخستین خواندن موفق بعدی (حداکثر یک TTL بعد)
  اعمال می‌شود.
- **مسیر ممنوع ⟸ `RobotsDisallowed`.** حلقه‌ها همان رفتار همیشگی‌شان را
  دارند: استثنا فقط لاگ می‌شود و همان منبع کهنه می‌ماند؛ نوبت ادامه دارد
  و درخواستِ ممنوع هرگز بیرون نمی‌رود.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from .pipeline import FetchJson

# یک‌بار در روز برای هر میزبان — هم مؤدب، هم به‌قدر کافی تازه (docstring).
ROBOTS_TTL_SECONDS = 24 * 60 * 60

log = logging.getLogger("mazane.collector.robots")


class RobotsDisallowed(Exception):
    """`robots.txt` میزبان این مسیر را برای ما بسته است — کهنگی منبع، نه سقوط."""


class RobotsGate:
    """کش `robots.txt` هر میزبان + داوری مسیر، روی کلاینت HTTP تزریقی.

    کلاینت همان `httpx.AsyncClient` مشترک گردآورنده است (User-Agent صادق،
    follow_redirects)؛ در تست‌ها فیک همان قرارداد `get(url)` می‌آید. ساعت
    تزریقی فقط برای تست سررسید TTL است.
    """

    def __init__(
        self,
        client: Any,
        *,
        user_agent: str,
        ttl_seconds: float = ROBOTS_TTL_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._user_agent = user_agent
        self._ttl = ttl_seconds
        self._clock = clock
        # origin ⟸ (پارسر یا None به معنی «همه‌چیز مجاز»، زمان خواندن).
        self._cache: dict[str, tuple[RobotFileParser | None, float]] = {}

    async def allows(self, url: str) -> bool:
        """آیا fetch این URL برای UA ما مجاز است؟ (ممنوعیت با هشدار لاگ می‌شود.)"""
        parts = urlsplit(url)
        if parts.scheme not in ("http", "https"):
            # robots.txt فقط برای HTTP معناست — خوراک وب‌سوکت داوری نمی‌شود.
            return True
        parser = await self._parser_for(f"{parts.scheme}://{parts.netloc}")
        if parser is None or parser.can_fetch(self._user_agent, url):
            return True
        log.warning(
            "robots.txt میزبان، مسیر %s را برای %s بسته است — این fetch رد می‌شود "
            "(کهنگی همان منبع، نه خطا)",
            url,
            self._user_agent,
        )
        return False

    async def _parser_for(self, origin: str) -> RobotFileParser | None:
        cached = self._cache.get(origin)
        now = self._clock()
        if cached is not None and now - cached[1] < self._ttl:
            return cached[0]
        parser = await self._fetch_parser(f"{origin}/robots.txt")
        self._cache[origin] = (parser, now)
        return parser

    async def _fetch_parser(self, robots_url: str) -> RobotFileParser | None:
        try:
            response = await self._client.get(robots_url)
        except Exception:
            # باز-به-شکست (docstring ماژول): قطعی robots گردآوری را نمی‌ایستاند.
            log.warning(
                "خواندن %s شکست خورد — باز-به-شکست تا سررسید TTL بعدی",
                robots_url,
                exc_info=True,
            )
            return None
        status = int(response.status_code)
        if 200 <= status < 300:
            parser = RobotFileParser()
            parser.parse(str(response.text).splitlines())
            return parser
        if 400 <= status < 500:
            # نبود robots.txt یعنی همه‌چیز مجاز (RFC 9309) — طبیعی است، بی‌هشدار.
            return None
        log.warning(
            "پاسخ %s برای %s — باز-به-شکست تا سررسید TTL بعدی (docstring ماژول)",
            status,
            robots_url,
        )
        return None


def robots_checked_fetch(gate: RobotsGate, fetch_json: FetchJson) -> FetchJson:
    """fetch سکوها را پشت داوری robots می‌گذارد؛ مسیر ممنوع ⟸ `RobotsDisallowed`.

    در main پیش از `compose_fetch` می‌نشیند تا فریم‌های وب‌سوکتِ کش‌شده
    (که fetch HTTP ندارند) بی‌جهت داوری نشوند.
    """

    async def fetch(url: str) -> Any:
        if not await gate.allows(url):
            raise RobotsDisallowed(url)
        return await fetch_json(url)

    return fetch
