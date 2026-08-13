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

# ⚠️ تاریخ مشاهده‌ی کارمزد دستی است، نه زمان گردآوری — با `fetched_at` جابه‌جا نشود.
DARIC_FEE_OBSERVED_AT = datetime(2026, 8, 10, tzinfo=UTC)

SIGNALR_RECORD_SEPARATOR = "\x1e"


def _decimal(value: Any, side_name: str) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:
        raise AdapterError(f"داریک: قیمت {side_name} نامعتبر است: {value!r}") from exc


def _order_price(order: Any, side_name: str) -> Decimal | None:
    if order is None:
        return None
    if not isinstance(order, dict):
        raise AdapterError(f"داریک: {side_name} نه شیء سفارش است نه تهی")
    return _decimal(order.get("price"), side_name)


def _top_of_book(payload: dict[str, Any]) -> tuple[Decimal | None, Decimal | None]:
    data = payload.get("Data")
    if isinstance(data, dict):
        return (
            _decimal(data.get("BestBuyPrice"), "BestBuyPrice"),
            _decimal(data.get("BestSellPrice"), "BestSellPrice"),
        )
    return (
        _order_price(payload.get("bestBuy"), "bestBuy"),
        _order_price(payload.get("bestSell"), "bestSell"),
    )


def decode_signalr_message(raw: str) -> Any | None:
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
    scale = Decimal("1")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        if not isinstance(payload, dict):
            raise AdapterError("داریک: payload شیء JSON نیست")

        raw_bid, raw_ask = _top_of_book(payload)

        if raw_bid is None or raw_ask is None:
            raise AdapterError("داریک: دفتر یک‌سمته است — این نوبت قیمت ندارد")

        return order_book_snapshot(
            slug=self.slug,
            raw_first=raw_bid,
            raw_second=raw_ask,
            scale=self.scale,
            fetched_at=fetched_at,
            observed_at=DARIC_FEE_OBSERVED_AT,
        )
