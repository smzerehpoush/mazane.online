"""آداپتر داریک — دو خوراک، یک سکو (بند ۱۲.۳ سند معماری).

- **REST (خوراک اصلی):** `apisc.daric.gold/loan/api/v1/User/Collateral/GetGoldlPrice`
  ⟸ `Data.BestBuyPrice` / `Data.BestSellPrice` سرِ دفتر سفارش، **رشته‌ی**
  تومان بر گرم، ضریب ×۱ (تأییدشده با پاسخ زنده‌ی ۲۰۲۶-۰۸-۱۰). این endpoint
  همان دو عددِ `topprice/GOLD18TMN` را می‌دهد، فقط با نام فیلد متفاوت و
  بدون `amount` (عمق سرِ دفتر).
- **وب‌سوکت (دفتر سفارش):** `wss://apie.daric.gold/ws/hubs` — هاب SignalR
  (endpoint ‏negotiate با «WebSockets/JSON» تأیید شد ۲۰۲۶-۰۸-۰۶؛ خود فریم‌ها
  «تأییدنشده» ماندند — سند تحقیق ۰۱، «چیزهایی که نتوانستم تأیید کنم» ردیف ۱).
  `decode_signalr_message` پوشش SignalR را باز می‌کند و همان payload شکل REST
  را بیرون می‌دهد ⟸ یک `parse` برای هر دو خوراک؛ فرض شکل فریم در فیکسچر
  `daric_ws_frames.json` مستند است و هر شکل غیرمنتظره فقط نادیده گرفته می‌شود
  (کهنگی، نه سقوط).

نکات مدل (بند ۹.۲ نکته‌ی ۵ سند معماری؛ سند تصمیم ۰۰۰۲):

- داریک **دفتر سفارش** است نه OTC؛ `Platform.market_model = ORDER_BOOK` و
  لایه‌ی وب برچسب «دفتر سفارش» می‌زند.
- **قیمت داریک = میانگین دو سرِ دفتر** و **کارمزدش ۰٪** است (تصمیم مالک
  ۲۰۲۶-۰۸-۱۰). اسپردِ دفتر عمداً به‌عنوان کارمزد ثبت نمی‌شود: سفارشِ
  کاربران دیگر است و درآمد هیچ‌کس نیست، پس `IMPLIED` هم برایش غلط بود.
  پیامدش این است که رفت‌وبرگشت داریک ۰٪ گزارش می‌شود در حالی که خرید و
  فروش فوری سرِ دفتر واقعاً `1 − bid/ask` هزینه دارد؛ جنبه‌ی حقوقی این
  ادعا را مالک جدا حل کرده است.
- `bestSell` (و قرینه‌اش `bestBuy`) گاهی **تهی** است ⟸ آن نوبت میانگینی
  وجود ندارد و داریک **قیمت ندارد**: `AdapterError` می‌دهیم و آخرین عدد
  سالم کهنه می‌شود (قاعده‌ی سخت ۵). پیش‌تر تنها سمتِ موجود ذخیره می‌شد؛
  آن عدد سوگیرانه بود (فقط `bestSell` مانده ⟸ بالاتر از میانگین) و با
  مرتب‌سازی جدول، رتبه‌ی داریک به این وابسته می‌شد که کدام سمت دفتر خالی
  شده — نه به این‌که چقدر خوب است.
- نگاشت سمت‌ها با قاعده‌ی ثابت `ask_bid` است، نه با نام فیلد.
- ⚠️ **دو شکل payload، یک `parse`:** خوراک REST شکل تخت
  `Data.BestBuyPrice/BestSellPrice` (رشته) دارد و خوراک وب‌سوکت شکل تودرتوی
  `bestBuy.price/bestSell.price` (عدد). `_top_of_book` هر دو را به یک جفت
  `Decimal` می‌رساند تا بقیه‌ی مسیر یکی بماند — وگرنه دو نسخه‌ی موازی از
  همین منطق پیدا می‌شد و یکی‌شان بی‌سروصدا کهنه می‌ماند.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import order_book_snapshot

DARIC_REST_ENDPOINT = (
    "https://apisc.daric.gold/loan/api/v1/User/Collateral/GetGoldlPrice"
)
DARIC_WS_ENDPOINT = "wss://apie.daric.gold/ws/hubs"

# تاریخ تصمیم مالک درباره‌ی کارمزد ۰٪ — برچسب «دستی — مشاهده‌شده در …» در
# UI همین را نشان می‌دهد، پس نباید با زمان گردآوری جابه‌جا شود.
DARIC_FEE_OBSERVED_AT = datetime(2026, 8, 10, tzinfo=UTC)

# جداکننده‌ی رکورد پروتکل SignalR (ASP.NET Core): هر پیام ws می‌تواند چند
# رکورد JSON با پایانه‌ی 0x1E داشته باشد.
SIGNALR_RECORD_SEPARATOR = "\x1e"


def _decimal(value: Any, side_name: str) -> Decimal | None:
    """عدد/رشته ⟸ Decimal؛ تهی ⟸ None (سمت بدون سفارش)، خراب ⟸ خطا."""
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:
        raise AdapterError(f"داریک: قیمت {side_name} نامعتبر است: {value!r}") from exc


def _order_price(order: Any, side_name: str) -> Decimal | None:
    """سمت دفتر در شکل **وب‌سوکت**: `{"price": …}` یا تهی."""
    if order is None:
        return None
    if not isinstance(order, dict):
        raise AdapterError(f"داریک: {side_name} نه شیء سفارش است نه تهی")
    return _decimal(order.get("price"), side_name)


def _top_of_book(payload: dict[str, Any]) -> tuple[Decimal | None, Decimal | None]:
    """سرِ دفتر از هر دو شکل payload — (bid, ask).

    `bid` بهترین سفارش **خرید** دفتر است و `ask` بهترین سفارش **فروش**؛
    نگاشتشان به سمت کاربر کار `ask_bid` در `common.py` است، نه اینجا.
    """
    data = payload.get("Data")
    if isinstance(data, dict):  # شکل REST تازه
        return (
            _decimal(data.get("BestBuyPrice"), "BestBuyPrice"),
            _decimal(data.get("BestSellPrice"), "BestSellPrice"),
        )
    # شکل وب‌سوکت (و خوراک REST قدیمی)
    return (
        _order_price(payload.get("bestBuy"), "bestBuy"),
        _order_price(payload.get("bestSell"), "bestSell"),
    )


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

        raw_bid, raw_ask = _top_of_book(payload)

        if raw_bid is None or raw_ask is None:
            # یک سمت (یا هر دو) بی‌سفارش ⟸ میانگینی وجود ندارد، پس این نوبت
            # قیمتی هم ندارد. خطا نیست: خط لوله همین را کهنگی می‌خواند و
            # آخرین عدد سالم با زمانش سرِ جایش می‌ماند (قاعده‌ی سخت ۵).
            raise AdapterError("داریک: دفتر یک‌سمته است — این نوبت قیمت ندارد")

        return order_book_snapshot(
            slug=self.slug,
            raw_first=raw_bid,
            raw_second=raw_ask,
            scale=self.scale,
            fetched_at=fetched_at,
            observed_at=DARIC_FEE_OBSERVED_AT,
        )
