"""زیرساخت خوراک وب‌سوکت — کش فریم، fetch ترکیبی، کلاینت reconnect دار.

قاعده‌ی حاکم (قاعده‌ی ۵ قراردادها + معیار پذیرش بلیت ۵): **قطع وب‌سوکت
به بیات‌شدگی می‌انجامد نه خطا.** هیچ‌چیز این ماژول استثنایی بیرون نمی‌دهد
که نوبت گردآوری یا فرایند را بکشد؛ تنها سیگنالش `FeedStale` است که در
`collect_round` مثل هر خطای منبع دیگری فقط لاگ می‌شود و آن سکو کهنه می‌ماند.

سه قطعه:

- `FeedCache` — آخرین payload رمزگشایی‌شده‌ی هر خوراک + زمان دریافت.
  فریم کهنه‌تر از `max_age_seconds` هرگز برنمی‌گردد (`FeedStale`).
- `compose_fetch` — یک `FetchJson` می‌سازد که «دو خوراک، یک سکو»ی داریک را
  پیاده می‌کند: برای REST ای که جفت وب‌سوکتی دارد اول فریم تازه‌ی کش، وگرنه
  خود REST؛ برای آدرس `wss://` فقط کش (کهنگی ⟸ `FeedStale`).
- `ReconnectingFeedClient` — حلقه‌ی همیشه‌زنده‌ی اتصال: هر قطع/خطا ⟸ لاگ +
  انتظار با backoff نمایی (سقف‌دار)؛ هر فریم معتبر backoff را صفر می‌کند.

اتصال واقعی (`websockets` + مذاکره‌ی SignalR داریک) در `main.py` تزریق
می‌شود؛ اینجا فقط قرارداد `connector` را می‌شناسیم تا تست‌ها بدون شبکه با
connector قلابی سبز شوند (قاعده‌ی ۶: در تست‌ها هیچ تماس شبکه‌ای نیست).
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from .pipeline import FetchJson

log = logging.getLogger("mazane.collector.ws")

Clock = Callable[[], datetime]
# یک اتصال: context manager ای که iterator پیام‌های متنی می‌دهد.
Connector = Callable[[], AbstractAsyncContextManager[AsyncIterator[str]]]
# رمزگشای فریم: پیام خام ⟸ payload یا None (فریم نامربوط — نادیده).
Decoder = Callable[[str], Any | None]

DEFAULT_FRAME_MAX_AGE_SECONDS = 90.0  # سه نوبتِ ۳۰ ثانیه‌ای بدون فریم = کهنه
DEFAULT_INITIAL_BACKOFF_SECONDS = 1.0
DEFAULT_MAX_BACKOFF_SECONDS = 60.0


class FeedStale(Exception):
    """خوراک وب‌سوکت فریم تازه ندارد (قطع/سکوت) — کهنگی است، نه خطا."""


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class _CachedFrame:
    payload: Any
    received_at: datetime


class FeedCache:
    def __init__(
        self,
        *,
        max_age_seconds: float = DEFAULT_FRAME_MAX_AGE_SECONDS,
        now: Clock = _utc_now,
    ) -> None:
        self._max_age = timedelta(seconds=max_age_seconds)
        self._now = now
        self._frames: dict[str, _CachedFrame] = {}

    def put(self, url: str, payload: Any) -> None:
        self._frames[url] = _CachedFrame(payload=payload, received_at=self._now())

    def latest(self, url: str) -> Any:
        """آخرین payload تازه‌ی خوراک؛ نبود یا کهنگی ⟸ `FeedStale`."""
        frame = self._frames.get(url)
        if frame is None:
            raise FeedStale(f"خوراک {url} هنوز فریمی نداده است")
        if self._now() - frame.received_at > self._max_age:
            raise FeedStale(f"آخرین فریم {url} کهنه‌تر از حد مجاز است")
        return frame.payload


def compose_fetch(
    http_fetch: FetchJson,
    cache: FeedCache,
    *,
    ws_primary: Mapping[str, str] | None = None,
) -> FetchJson:
    """fetch ترکیبی دو-خوراکه برای `collect_round`.

    - `ws_primary` جفت‌های «آدرس REST ⟸ آدرس وب‌سوکت» است (داریک): وقتی
      وب‌سوکت وصل است و فریم تازه دارد، همان برمی‌گردد (دفتر سفارش زنده)؛
      قطع/سکوت وب‌سوکت ⟸ بی‌سروصدا به خود REST برمی‌گردیم — «دو خوراک،
      یک سکو» و قطع خوراک دوم حتی کهنگی هم نمی‌سازد.
    - آدرس `wss://` بدون جفت REST (اینوی): فقط کش؛ کهنگی ⟸ `FeedStale`
      که در نوبت گردآوری مثل هر شکست منبع دیگری کهنگی است، نه خطا.
    """
    primary = dict(ws_primary or {})

    async def fetch(url: str) -> Any:
        ws_url = primary.get(url)
        if ws_url is not None:
            try:
                return cache.latest(ws_url)
            except FeedStale:
                pass  # خوراک اصلی REST است — وب‌سوکت فقط تازه‌ترش می‌کند.
        if url.startswith("wss://"):
            return cache.latest(url)
        return await http_fetch(url)

    return fetch


class ReconnectingFeedClient:
    """حلقه‌ی اتصال همیشه‌زنده‌ی یک خوراک وب‌سوکت.

    هر پایان اتصال — خطا یا بسته‌شدن تمیز — فقط لاگ می‌شود و پس از backoff
    دوباره وصل می‌شویم؛ backoff با هر شکست دو برابر (تا سقف) و با هر فریمِ
    رمزگشایی‌شده به مقدار اولیه برمی‌گردد. تنها راه خروج، cancel شدن تسک است.
    """

    def __init__(
        self,
        url: str,
        connector: Connector,
        decode: Decoder,
        cache: FeedCache,
        *,
        initial_backoff_seconds: float = DEFAULT_INITIAL_BACKOFF_SECONDS,
        max_backoff_seconds: float = DEFAULT_MAX_BACKOFF_SECONDS,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._url = url
        self._connector = connector
        self._decode = decode
        self._cache = cache
        self._initial_backoff = initial_backoff_seconds
        self._max_backoff = max_backoff_seconds
        self._sleep = sleep

    async def run(self) -> None:
        backoff = self._initial_backoff
        while True:
            try:
                async with self._connector() as messages:
                    log.info("خوراک %s وصل شد", self._url)
                    async for raw in messages:
                        payload = self._decode(raw)
                        if payload is None:
                            continue  # handshake/پینگ/فریم نامربوط
                        self._cache.put(self._url, payload)
                        backoff = self._initial_backoff  # اتصال سالم
                log.warning("خوراک %s بسته شد — کهنگی، نه خطا؛ اتصال دوباره", self._url)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("خوراک %s قطع شد — کهنگی، نه خطا؛ اتصال دوباره", self._url)
            await self._sleep(backoff)
            backoff = min(backoff * 2, self._max_backoff)
