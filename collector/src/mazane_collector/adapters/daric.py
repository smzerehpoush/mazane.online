"""آداپتر داریک — دو خوراک، یک سکو (بند ۱۲.۳ سند معماری).

- **REST (خوراک اصلی):** `apie.daric.gold/public/general/topprice/GOLD18TMN`
  ⟸ `bestBuy` / `bestSell` سرِ دفتر سفارش، تومان بر گرم، ضریب ×۱
  (سند تحقیق ۰۱، بندهای ۳.۱ و ۳.۳ — payload واقعی ضبط‌شده ۲۰۲۶-۰۸-۰۶).
- **وب‌سوکت (دفتر سفارش):** `wss://apie.daric.gold/ws/hubs` — هاب SignalR
  (endpoint ‏negotiate با «WebSockets/JSON» تأیید شد ۲۰۲۶-۰۸-۰۶؛ خود فریم‌ها
  «تأییدنشده» ماندند — سند تحقیق ۰۱، «چیزهایی که نتوانستم تأیید کنم» ردیف ۱).
  `decode_signalr_message` پوشش SignalR را باز می‌کند و همان payload شکل REST
  را بیرون می‌دهد ⟸ یک `parse` برای هر دو خوراک؛ فرض شکل فریم در فیکسچر
  `daric_ws_frames.json` مستند است و هر شکل غیرمنتظره فقط نادیده گرفته می‌شود
  (کهنگی، نه سقوط).

نکات مدل (بند ۹.۲ نکته‌ی ۵ سند معماری):

- داریک **دفتر سفارش** است نه OTC؛ `Platform.market_model = ORDER_BOOK` و
  لایه‌ی وب برچسب «دفتر سفارش» می‌زند.
- `bestSell` (و قرینه‌اش `bestBuy`) گاهی **تهی** است ⟸ «آن سمت الان سفارش
  ندارد»، نه خطا: سمتِ موجود ذخیره می‌شود، سمتِ غایب `*_enabled = False`.
- با هر دو سمت، BUY/SELL همان دو قیمتِ قابل‌معامله‌ی سرِ دفترند و
  «کارمزد» ضمنی همان نیم‌اسپرد دفتر است (رفت‌وبرگشت = 1 − bid/ask —
  هزینه‌ی واقعی خرید و فروش فوری سرِ دفتر). هم‌جنس نبودن این اسپرد با
  dealer ها را برچسب ORDER_BOOK شفاف می‌کند، نه حذف داده.
- نگاشت سمت‌ها در حالت دوطرفه با قاعده‌ی ثابت `ask_bid` است؛ در حالت
  یک‌طرفه ناچار از معنای فیلدیم (سند تحقیق ۰۱، بند ۳.۶): `bestBuy` بهترین
  سفارش خرید است ⟸ آنچه کاربرِ فروشنده می‌گیرد (SELL)؛ `bestSell` بهترین
  سفارش فروش ⟸ آنچه کاربرِ خریدار می‌پردازد (BUY). با داده‌ی زنده‌ی
  ۲۰۲۶-۰۸-۰۶ سازگار است (`bestSell` > `bestBuy`).
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot, Side
from ..pipeline import AdapterError
from .common import dealer_snapshot, one_sided_book_snapshot

DARIC_REST_ENDPOINT = "https://apie.daric.gold/public/general/topprice/GOLD18TMN"
DARIC_WS_ENDPOINT = "wss://apie.daric.gold/ws/hubs"

# جداکننده‌ی رکورد پروتکل SignalR (ASP.NET Core): هر پیام ws می‌تواند چند
# رکورد JSON با پایانه‌ی 0x1E داشته باشد.
SIGNALR_RECORD_SEPARATOR = "\x1e"


def _order_price(order: Any, side_name: str) -> Decimal | None:
    """قیمت یک سمت دفتر؛ تهی/غایب ⟸ None (سمت بدون سفارش)، خراب ⟸ خطا."""
    if order is None:
        return None
    if not isinstance(order, dict):
        raise AdapterError(f"داریک: {side_name} نه شیء سفارش است نه تهی")
    price = order.get("price")
    if price is None:
        return None
    try:
        return Decimal(str(price))
    except InvalidOperation as exc:
        raise AdapterError(f"داریک: قیمت {side_name} نامعتبر است: {price!r}") from exc


def decode_signalr_message(raw: str) -> Any | None:
    """پیام خام وب‌سوکت ⟸ آخرین payload سرِ دفتر (شکل REST)، یا None.

    handshake (`{}`)، پینگ (`type: 6`) و هر رکورد ناشناخته نادیده گرفته
    می‌شود — فریم نامفهوم یعنی «داده‌ی تازه‌ای نیامد»، نه خطا. invocation
    (`type: 1`) که در آرگومان‌هایش شیئی با `bestBuy`/`bestSell` دارد،
    همان payload خوراک REST است.
    """
    payload: Any | None = None
    for record in raw.split(SIGNALR_RECORD_SEPARATOR):
        if not record.strip():
            continue
        try:
            message = json.loads(record)
        except ValueError:
            continue
        if not isinstance(message, dict) or message.get("type") != 1:
            continue
        for argument in message.get("arguments") or ():
            if isinstance(argument, dict) and ("bestBuy" in argument or "bestSell" in argument):
                payload = argument
    return payload


class DaricAdapter:
    slug = "daric"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = DARIC_REST_ENDPOINT
    # ضریب صریح این منبع: تومان بر گرم، ×۱ (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        if not isinstance(payload, dict):
            raise AdapterError("داریک: payload شیء JSON نیست")

        raw_bid = _order_price(payload.get("bestBuy"), "bestBuy")
        raw_ask = _order_price(payload.get("bestSell"), "bestSell")

        if raw_bid is not None and raw_ask is not None:
            # دو سمت ⟸ همان شکل dealer، با قاعده‌ی ثابت ask_bid (نه نام فیلد).
            return dealer_snapshot(
                slug=self.slug,
                raw_first=raw_bid,
                raw_second=raw_ask,
                scale=self.scale,
                fetched_at=fetched_at,
            )
        if raw_bid is not None:
            # bestSell تهی ⟸ سمت خرید کاربر بی‌سفارش است، نه خطا (بند ۹.۲).
            return one_sided_book_snapshot(
                slug=self.slug,
                side=Side.SELL,
                raw_value=raw_bid,
                scale=self.scale,
                fetched_at=fetched_at,
            )
        if raw_ask is not None:
            return one_sided_book_snapshot(
                slug=self.slug,
                side=Side.BUY,
                raw_value=raw_ask,
                scale=self.scale,
                fetched_at=fetched_at,
            )
        raise AdapterError("داریک: هر دو سمت دفتر تهی است — payload بی‌استفاده")
