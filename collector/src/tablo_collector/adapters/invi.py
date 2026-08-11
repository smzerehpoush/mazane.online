"""آداپتر اینوی — فقط وب‌سوکت: `wss://invi.ir/ws` (بند ۱۲.۱ ردیف ۱۴).

⚠️ وضعیت راستی‌آزمایی (سند تحقیق ۰۱، بند ۲.۲ و «چیزهایی که نتوانستم تأیید
کنم» ردیف ۱): سایت SPA است، endpoint ای جز وب‌سوکت ندارد و **شکل پیام
تأییدنشده است**. تلاش اتصال ۲۰۲۶-۰۸-۰۶ از این شبکه ۴۰۳ گرفت (احتمالاً
Origin/هدر مرورگری می‌خواهد). بنابراین:

- شکل فریمِ فرضی در فیکسچر `invi_ws_price.json` مستند است:
  `{"symbol": "GOLD18", "price": <تومان بر گرم>}` — با اولین اتصال زنده
  باید بازبینی شود.
- پارسر عمداً سخت‌گیر است: هر شکل دیگری ⟸ `AdapterError` ⟸ در نوبت
  گردآوری فقط لاگ و کهنگی، هرگز سقوط (قاعده‌ی ۵ قراردادها).
- کارمزد اینوی هیچ‌جا منتشر نشده ⟸ `fee_source = UNKNOWN`: فقط MID،
  قیمت مؤثر جعل نمی‌شود.
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import Instrument, PlatformSnapshot
from ..pipeline import AdapterError
from .common import unknown_fee_snapshot

INVI_WS_ENDPOINT = "wss://invi.ir/ws"
GOLD_SYMBOL = "GOLD18"


def decode_invi_message(raw: str) -> Any | None:
    """پیام خام وب‌سوکت ⟸ payload قیمت، یا None (فریم نامربوط/ناشناخته).

    فریم نامفهوم «داده‌ی تازه نیامد» است، نه خطا — تشخیص خرابیِ payloadِ
    شناخته‌شده کار `InviAdapter.parse` است.
    """
    try:
        message = json.loads(raw)
    except ValueError:
        return None
    if isinstance(message, dict) and message.get("symbol") == GOLD_SYMBOL:
        return message
    return None


class InviAdapter:
    slug = "invi"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = INVI_WS_ENDPOINT
    # ضریب فرضی این منبع: تومان بر گرم، ×۱ — با اولین فریم زنده بازبینی شود.
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        if not isinstance(payload, dict) or payload.get("symbol") != GOLD_SYMBOL:
            raise AdapterError("اینوی: payload فریم قیمت GOLD18 نیست")
        price = payload.get("price")
        if price is None:
            raise AdapterError("اینوی: قیمت در فریم تهی است")
        try:
            raw_mid = Decimal(str(price))
        except InvalidOperation as exc:
            raise AdapterError(f"اینوی: قیمت نامعتبر است: {price!r}") from exc

        return unknown_fee_snapshot(
            slug=self.slug,
            raw_price=raw_mid,
            scale=self.scale,
            fetched_at=fetched_at,
        )
