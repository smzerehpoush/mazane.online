"""مدل‌های داده — بند ۲.۲ سند معماری.

`raw_value` و `raw_scale` همیشه ذخیره می‌شوند تا اگر روزی ضریب منبعی اشتباه
از آب درآمد، تاریخچه قابل بازسازی باشد. `fee_source` تفکیک می‌کند که کارمزد
از API آمده یا دستی ثبت شده است.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError, computed_field, model_validator

from .pricing import reference_price_toman


class Side(StrEnum):
    """سمت یک سطر قیمت.

    - `BUY` / `SELL`: قیمت **مؤثر** خرید/فروش (با کارمزد) — بند ۱ سند معماری.
    - `MID`: قیمت اسمی، همان عددی که خود سکو منتشر می‌کند.
    - `MEAN`: **قیمت مرجع خودِ همان سکو** — عدد واحدی که آن سکو را روی نمودار
      و در محتوا نمایندگی می‌کند (CONTEXT.md، «قیمت مرجع سکو»؛ تصمیم صاحب
      کسب‌وکار ۲۰۲۶-۰۸-۰۶): سکوی دوقیمتی ⟸ میانگین دو عدد خودش، سکوی
      تک‌قیمتی ⟸ همان تک‌عدد.

    ⚠️ `MEAN` **هرگز میانگین بین‌سکویی نیست** (قاعده‌ی ۴ قراردادها، خط قرمز
    حقوقی بند ۷.۱): هر سطر MEAN `platform_slug` خودش را دارد و فقط از سطرهای
    همان یک سکو ساخته می‌شود؛ هیچ‌جا عددی از دو سکو با هم میانگین نمی‌گیرد.

    ⚠️ با جدول `reference_quotes` هم اشتباه نشود: آن جدول مالِ **مرجع قیمت**
    است (tala.ir، بن‌بست) — منبع بیرونیِ اعتبارسنجی که اصلاً سکو نیست، در
    جدول مقایسه ردیف ندارد و در رأی چک میانه شرکت نمی‌کند. `MEAN` برعکس،
    سطر خودِ سکو در جدول `quotes` است؛ آن هم در رأی چک میانه نمی‌آید — رأی
    فقط با `MID` است (`sanity.py`).
    """

    BUY = "BUY"
    SELL = "SELL"
    MID = "MID"
    MEAN = "MEAN"


class Instrument(StrEnum):
    GOLD_18K = "GOLD_18K"
    ABSHODE_MITHQAL = "ABSHODE_MITHQAL"
    SILVER_990 = "SILVER_990"
    XAU = "XAU"


class FeeSource(StrEnum):
    """`UNKNOWN` یعنی سکو کارمزدش را نه در API می‌دهد و نه جایی منتشر کرده
    (مثل دیجی‌کالا — سند تحقیق ۰۱، بند ۸.۱): فقط mid ذخیره می‌شود و قیمت
    مؤثر **جعل نمی‌شود** — «یک ردیف صادقانه با نامشخص بهتر از عدد ساختگی»."""

    API = "API"
    MANUAL = "MANUAL"
    UNKNOWN = "UNKNOWN"


class DataPolicy(StrEnum):
    """کلید حقوقی هر سکو — بند ۲.۲ سند معماری. تغییرش دیپلوی نمی‌خواهد."""

    ALLOWED = "ALLOWED"
    RESTRICTED = "RESTRICTED"
    PERMISSION_PENDING = "PERMISSION_PENDING"
    BLOCKED = "BLOCKED"


class MarketModel(StrEnum):
    """مدل معاملاتی سکو — بند ۹.۲ نکته‌ی ۵ سند معماری.

    داریک دفتر سفارش است نه OTC: قیمتش سرِ دفتر است (ممکن است نقدینگی
    نداشته باشد و یک سمتش تهی باشد) و اسپردش هم‌جنس dealer ها نیست ⟸ لایه‌ی
    وب با همین فیلد برچسب «دفتر سفارش» می‌زند. بقیه‌ی سکوها OTC اند.
    """

    OTC = "OTC"
    ORDER_BOOK = "ORDER_BOOK"


class Platform(BaseModel):
    """فراداده‌ی سکو — ثابت، دستی نگهداری می‌شود (بند ۲.۲ سند معماری).

    فیلدهای اختیاری خوراک صفحه‌ی سکو (بلیت ۷)اند و فقط از سند تحقیق ۰۱
    پر می‌شوند — جایی که مستند نیست None می‌ماند؛ **هیچ مقداری حدس زده
    نمی‌شود** (همان اصل «عدد ساختگی ممنوع» برای فراداده).
    """

    model_config = ConfigDict(frozen=True)

    slug: str
    name_fa: str
    data_policy: DataPolicy
    market_model: MarketModel = MarketModel.OTC
    # نام لاتین برند — از دامنه‌ی مستند در سند تحقیق ۰۱ (بند ۲.۱/۲.۲).
    name_en: str | None = None
    website_url: str | None = None
    # هویت حقوقی، فقط اگر جایی مستند شده (مثلاً <title> خود سکو).
    legal_entity: str | None = None
    # شرایط تحویل فیزیکی به روایت سند تحقیق ۰۱ — متن کوتاه فارسی با عدد مستند.
    delivery_note_fa: str | None = None
    # لینک معرف (بند ۱۳، تصمیم ۲۱): آدرس کامل مقصدِ ‎/go/<slug>‎ با کد معرف
    # مالک. **کدها را صاحب کسب‌وکار بعداً تحویل می‌دهد** — تا آن روز None
    # می‌ماند و ‎/go/‎ به website_url می‌رود (لینک مستقیم).
    referral_url: str | None = None
    # الگوی پارامتر معرف سکو، فقط جایی که سند تحقیق ۰۱ (بند ۶.۲) مستندش
    # کرده: "referralCode" (میلی، تکنوگلد) / "r" (طلاسی)؛ گلدیکا اصلاً
    # پارامتر ندارد ⟸ None. پارامترِ بی‌کد است — با آمدن کد، referral_url
    # از همین الگو ساخته می‌شود.
    # ⚠️ بند ۶.۴: این دو فیلد **هرگز** ورودی مرتب‌سازی/ترتیب نمایش نیستند —
    # ترتیب فقط از قیمت مؤثر می‌آید؛ تستش در مرز وب است.
    referral_param: str | None = None

    @property
    def is_listed(self) -> bool:
        """نمایش عمومی فقط تابع data_policy است (بند ۱۳، تصمیم ۲۰)."""
        return self.data_policy == DataPolicy.ALLOWED


class Quote(BaseModel):
    """یک قیمت منتسب به یک سکو، همیشه تومان بر گرم.

    برای سطرهای BUY/SELL مقدار `price_toman` قیمت «مؤثر» است (با کارمزد)،
    محاسبه‌شده در گردآورنده — لایه‌ی وب هیچ فرمولی ندارد.
    """

    model_config = ConfigDict(frozen=True)

    platform_slug: str
    instrument: Instrument
    side: Side
    price_toman: int
    raw_value: Decimal
    raw_scale: Decimal
    fetched_at: datetime


class PlatformTerms(BaseModel):
    """شرایط تجاری سکو — چرخه‌ی عمر جدا از قیمت (کارمزد شاید ماهی یک‌بار عوض شود).

    کارمزدها فقط با `fee_source = UNKNOWN` تهی‌اند؛ در آن حالت هر سه تهی‌اند
    — عدد نصفه‌نیمه یعنی باگ، نه داده.
    """

    model_config = ConfigDict(frozen=True)

    platform_slug: str
    buy_fee_percent: Decimal | None
    sell_fee_percent: Decimal | None
    round_trip_percent: Decimal | None
    fee_source: FeeSource
    buy_enabled: bool
    sell_enabled: bool
    observed_at: datetime
    # حداقل ارزش سفارش به تومان — فقط جایی که خود منبع منتشرش می‌کند (مثل
    # `minOrderValue` وال‌گلد یا `lower_amounts` ملی‌گلد — سند تحقیق ۰۱).
    # نامستند/نیامده ⟸ None؛ **جعل نمی‌شود** (همان اصل «عدد ساختگی ممنوع»).
    # خوراک پست داده‌محور «حداقل سفارش» (بلیت‌های ۱۴/۱۵) از همین فیلد است.
    min_order_toman: int | None = None

    @model_validator(mode="after")
    def _fees_match_source(self) -> PlatformTerms:
        fees = (self.buy_fee_percent, self.sell_fee_percent, self.round_trip_percent)
        if self.fee_source is FeeSource.UNKNOWN:
            if any(fee is not None for fee in fees):
                raise ValueError("کارمزد UNKNOWN نباید عدد داشته باشد — عدد ساختگی ممنوع")
        elif any(fee is None for fee in fees):
            raise ValueError("کارمزد API/MANUAL باید هر سه عدد را داشته باشد")
        return self


def _mean_of_pair(buy: Quote, sell: Quote) -> Quote:
    """سطر MEAN یک دارایی دوسمته: میانگین مؤثر خرید و فروش **همان سکو**.

    `raw_value` میانگین دو مقدار خام است و برای همین `raw_scale` هر دو سمت
    باید یکی باشد — وگرنه میانگینِ خام دو مقیاسِ متفاوت عددی بی‌معناست
    (قاعده‌ی ۲ قراردادها: مقدار خام و ضریبش باید همیشه با هم بخوانند).
    `fetched_at` و `platform_slug` از همان سطرهای مبدأ می‌آیند — همه‌ی سطرهای
    یک اسنپ‌شات از یک نوبت گردآوری‌اند و زمانشان یکی است.
    """
    if buy.raw_scale != sell.raw_scale:
        raise ValueError(
            f"قیمت مرجع {buy.platform_slug}/{buy.instrument.value}: ضریب دو سمت یکی "
            f"نیست ({buy.raw_scale} ≠ {sell.raw_scale}) — میانگین خام بی‌معناست"
        )
    return Quote(
        platform_slug=buy.platform_slug,
        instrument=buy.instrument,
        side=Side.MEAN,
        price_toman=reference_price_toman(buy.price_toman, sell.price_toman),
        raw_value=(buy.raw_value + sell.raw_value) / 2,
        raw_scale=buy.raw_scale,
        fetched_at=buy.fetched_at,
    )


def _missing_mean_quotes(quotes: Sequence[Quote]) -> tuple[Quote, ...]:
    """سطرهای MEAN غایب را برای هر دارایی می‌سازد (قاعده‌ی بالای `Side.MEAN`).

    ۱. هر دو سمت BUY و SELL ⟸ میانگینشان (همان `reference_price_toman`).
    ۲. وگرنه MID ⟸ خودِ MID (سکوی تک‌قیمتی: عددی که منتشر کرده مرجع اوست،
       چه کارمزدش معلوم باشد چه نامعلوم — این تفسیر «تک عدد» است، نه جعلِ
       قیمت مؤثر: هیچ کارمزدی به آن اعمال نشده).
    ۳. وگرنه (دفتر سفارش یک‌طرفه) ⟸ هیچ: سکو در این نوبت قیمت مرجع ندارد و
       عدد ساختگی ساخته نمی‌شود.

    دارایی‌ای که از قبل سطر MEAN دارد دست‌نخورده می‌ماند — همین idempotency
    است که بازسازی اسنپ‌شات از JSON ردیس یا ردیف‌های پستگرس را بی‌خطر می‌کند.
    """
    by_instrument: dict[Instrument, dict[Side, Quote]] = {}
    for quote in quotes:
        by_instrument.setdefault(quote.instrument, {})[quote.side] = quote

    built: list[Quote] = []
    for sides in by_instrument.values():
        if Side.MEAN in sides:
            continue
        buy, sell = sides.get(Side.BUY), sides.get(Side.SELL)
        if buy is not None and sell is not None:
            built.append(_mean_of_pair(buy, sell))
            continue
        mid = sides.get(Side.MID)
        if mid is not None:
            # model_copy اعتبارسنجی را دوباره اجرا نمی‌کند — فقط سمت عوض می‌شود.
            built.append(mid.model_copy(update={"side": Side.MEAN}))
    return tuple(built)


class PlatformSnapshot(BaseModel):
    """خروجی یک نوبت گردآوری موفق برای یک سکو: قیمت‌ها + شرایط.

    `suppressed=True` یعنی چک میانه‌ی تقاطعی (قاعده‌ی ۳ قراردادها) این نوبت را
    رد کرده: در استور قیمت جاری منتشر نمی‌شود، فقط در تاریخچه با همین پرچم
    ثبت می‌ماند.

    سطر `MEAN` (قیمت مرجع سکو) را **خود مدل** می‌سازد، نه آداپترها: یک آداپترِ
    فراموش‌کار یعنی سکویی بی‌خط روی نمودار، و دو مسیرِ ساخت یعنی واگرایی JSON
    کانونی با پستگرس. مدل تنها دروازه‌ی هر دو مقصد است، پس فرمول یک‌جا می‌ماند.
    """

    model_config = ConfigDict(frozen=True)

    platform_slug: str
    quotes: tuple[Quote, ...]
    terms: PlatformTerms
    fetched_at: datetime
    suppressed: bool = False

    @model_validator(mode="before")
    @classmethod
    def _add_reference_price_rows(cls, data: Any) -> Any:
        """سطرهای غایبِ `MEAN` را پیش از ساخت نمونه به `quotes` اضافه می‌کند.

        چرا `mode="before"` و نه `mode="after"`: پایدانتیک ۲ از اعتبارسنجِ
        `after` سطح-مدل چیزی جز `self` نمی‌پذیرد — نمونه‌ی تازه هنگام ساخت با
        `__init__` دور ریخته می‌شود (فقط هشدار می‌دهد). پس افزودن سطر باید
        پیش از ساخته‌شدن نمونه‌ی frozen انجام شود.

        **idempotent است**: اسنپ‌شات از JSON ردیس یا از ردیف‌های پستگرس دوباره
        ساخته می‌شود و آن سطرهای MEAN را همراه دارد ⟸ `_missing_mean_quotes`
        دارایی‌های دارای MEAN را رد می‌کند و هیچ سطر تکراری‌ای اضافه نمی‌شود.
        `model_copy` (مثلاً پرچم‌زدن سرکوب در خط لوله) اصلاً اعتبارسنجی را
        دوباره اجرا نمی‌کند، پس آن مسیر هم امن است.
        """
        if not isinstance(data, dict) or "quotes" not in data:
            return data
        try:
            quotes = tuple(Quote.model_validate(quote) for quote in data["quotes"])
        except (TypeError, ValidationError):
            # ورودی خراب: دست نمی‌زنیم تا پیام خطای عادی پایدانتیک برسد.
            return data
        missing = _missing_mean_quotes(quotes)
        if not missing:
            return data
        return {**data, "quotes": quotes + missing}

    @computed_field  # type: ignore[prop-decorator]
    @property
    def reference_prices_toman(self) -> dict[str, int]:
        """قیمت مرجع این سکو به‌ازای هر دارایی — computed_field است تا در JSON
        کانونی (همان که ردیس/وب می‌خوانند) همیشه حاضر باشد و شکل payload برای
        وب دقیقاً مثل قبل بماند.

        فقط **انتخابِ** سطرهای `MEAN` است، نه محاسبه‌ی دوباره: تنها منبع
        حقیقتِ قیمت مرجع همان سطرهای جدول `quotes` اند، پس JSON و پستگرس
        هرگز واگرا نمی‌شوند. دارایی بدون سطر MEAN (دفتر سفارش یک‌طرفه) کلید
        نمی‌گیرد — جعل نمی‌شود. هیچ عدد بین‌سکویی‌ای اینجا وجود ندارد.
        """
        return {
            quote.instrument.value: quote.price_toman
            for quote in self.quotes
            if quote.side is Side.MEAN
        }

    @model_validator(mode="after")
    def _no_effective_price_without_fee(self) -> PlatformSnapshot:
        """کارمزد نامعلوم ⟸ قیمت مؤثر BUY/SELL **جعل نمی‌شود**.

        جعل یعنی mid×(1±f) با f نامعلوم؛ پس با UNKNOWN دو شکل صادقانه مجاز
        است: فقط MID (سکوی تک‌قیمتی)، یا **یک** سطر یک‌طرفه‌ی خودِ منبع —
        دفتر سفارش داریک وقتی یک سمتش تهی است (بند ۹.۲ نکته‌ی ۵): قیمتِ
        سمتِ موجود عین سفارشِ سرِ دفتر است، نه مشتق از کارمزد.

        `MEAN` موضوع این چک نیست و صریحاً بیرون گذاشته می‌شود: قیمت مؤثر
        نیست، بازتاب همان عددِ منتشرشده است و هیچ کارمزدی رویش نرفته — پس
        نه با MID تعارض دارد نه «سمتِ دوم» به شمار می‌آید.
        """
        if self.terms.fee_source is not FeeSource.UNKNOWN:
            return self
        sides = [quote for quote in self.quotes if quote.side in (Side.BUY, Side.SELL)]
        if not sides:
            return self
        if any(quote.side is Side.MID for quote in self.quotes):
            raise ValueError("با کارمزد UNKNOWN سطر BUY/SELL کنار MID یعنی قیمت جعلی")
        if len(sides) > 1:
            raise ValueError("با کارمزد UNKNOWN فقط یک سطر یک‌طرفه‌ی دفتر سفارش مجاز است")
        return self
