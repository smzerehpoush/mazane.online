"""آداپتر میلی — `milli.gold/api/v1/public/milli-price/external`.

نکات تأییدشده (سند تحقیق ۰۱، بندهای ۳.۳ و ۳.۴):

- `data.price18` قیمت هر میلی‌گرم به ریال است ⟸ ضریب صریح ×۱۰۰ به
  تومان بر گرم (بند ۴ سند معماری).
- API عمومی میلی کارمزد نمی‌دهد ⟸ کارمزد **دستی** از صفحه‌ی کارمزد میلی
  (`milli.gold/main/commision/`) خوانده شده: ۰٫۵٪ خرید و ۰٫۵٪ فروش.
  عدد دستی باید تاریخ مشاهده داشته باشد و در UI برچسب «دستی» بخورد
  (بند ۲.۲ سند معماری) — از همین‌رو `fee_source = MANUAL` و
  `observed_at = MILLI_FEE_OBSERVED_AT` (نه زمان کرال).
- API فیلد وضعیت باز/بسته ندارد ⟸ هر دو سمت باز فرض می‌شود.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from ..models import (
    FeeSource,
    Instrument,
    PlatformSnapshot,
    PlatformTerms,
    Quote,
    Side,
)
from ..pipeline import AdapterError
from ..pricing import effective_buy_toman, effective_sell_toman, round_trip_percent

MILLI_ENDPOINT = "https://milli.gold/api/v1/public/milli-price/external"

# کارمزد دستی میلی — مشاهده‌شده در سند تحقیق ۰۱ (اسنپ‌شات ۲۰۲۶-۰۸-۰۵،
# صفحه‌ی milli.gold/main/commision/): ۰٫۵٪ هر سمت. اگر میلی کارمزدش را عوض
# کند این ثابت‌ها باید دستی به‌روز شوند؛ برچسب «دستی» در UI همین ریسک را
# شفاف می‌کند.
MILLI_MANUAL_BUY_FEE = Decimal("0.005")
MILLI_MANUAL_SELL_FEE = Decimal("0.005")
MILLI_FEE_OBSERVED_AT = datetime(2026, 8, 5, tzinfo=UTC)


class MilliAdapter:
    slug = "milli"
    instruments: tuple[Instrument, ...] = (Instrument.GOLD_18K,)
    endpoint = MILLI_ENDPOINT
    # ضریب صریح این منبع: ریال بر میلی‌گرم، ×۱۰۰ به تومان بر گرم
    # (سند تحقیق ۰۱، بند ۳.۳).
    scale = Decimal("100")

    def parse(self, payload: Any, fetched_at: datetime) -> PlatformSnapshot:
        if not isinstance(payload, dict):
            raise AdapterError("میلی: payload یک شیء JSON نیست")

        raw_price = (payload.get("data") or {}).get("price18")
        if raw_price is None:
            raise AdapterError("میلی: قیمت price18 در payload تهی است")
        try:
            raw_value = Decimal(str(raw_price))
        except InvalidOperation as exc:
            raise AdapterError(f"میلی: payload نامعتبر: {exc!r}") from exc

        mid_toman = int(raw_value * self.scale)

        def quote(side: Side, price_toman: int) -> Quote:
            return Quote(
                platform_slug=self.slug,
                instrument=Instrument.GOLD_18K,
                side=side,
                price_toman=price_toman,
                raw_value=raw_value,
                raw_scale=self.scale,
                fetched_at=fetched_at,
            )

        terms = PlatformTerms(
            platform_slug=self.slug,
            buy_fee_percent=MILLI_MANUAL_BUY_FEE * 100,
            sell_fee_percent=MILLI_MANUAL_SELL_FEE * 100,
            round_trip_percent=round_trip_percent(
                MILLI_MANUAL_BUY_FEE, MILLI_MANUAL_SELL_FEE
            ),
            fee_source=FeeSource.MANUAL,
            buy_enabled=True,
            sell_enabled=True,
            observed_at=MILLI_FEE_OBSERVED_AT,
        )

        return PlatformSnapshot(
            platform_slug=self.slug,
            quotes=(
                quote(Side.MID, mid_toman),
                quote(
                    Side.BUY,
                    effective_buy_toman(Decimal(mid_toman), MILLI_MANUAL_BUY_FEE),
                ),
                quote(
                    Side.SELL,
                    effective_sell_toman(Decimal(mid_toman), MILLI_MANUAL_SELL_FEE),
                ),
            ),
            terms=terms,
            fetched_at=fetched_at,
        )
