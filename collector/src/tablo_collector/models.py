"""مدل‌های داده — بند ۲.۲ سند معماری.

`raw_value` و `raw_scale` همیشه ذخیره می‌شوند تا اگر روزی ضریب منبعی اشتباه
از آب درآمد، تاریخچه قابل بازسازی باشد. `fee_source` تفکیک می‌کند که کارمزد
از API آمده، دستی ثبت شده، از اسپرد استنتاج شده، یا اصلاً معلوم نیست.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, model_validator


class Side(StrEnum):
    """سمت یک سطر قیمت — امروز فقط یک مقدار دارد.

    `PRICE` = «قیمت» (CONTEXT.md): تنها عددی که از هر سکو ثبت می‌شود، تومان
    بر گرم، **پیش از هر کارمزد**. منبع تک‌قیمتی ⟸ همان عددش؛ منبع دوقیمتی ⟸
    میانگین دو عددش (تصمیم صاحب کسب‌وکار ۲۰۲۶-۰۸-۱۰؛ سند تصمیم ۰۰۰۲).

    ⚠️ **قیمت مؤثر وجود ندارد.** پیش‌تر `BUY`/`SELL` قیمتِ با-کارمزد بودند و
    `MEAN` «قیمت مرجع سکو»؛ هر سه حذف شدند. کارمزد جدا در `PlatformTerms`
    ثبت می‌شود و هرگز در قیمت ضرب نمی‌شود.

    ⚠️ عدد هر سطر همیشه به **یک سکوی نام‌برده** منتسب است؛ هیچ‌جا عددی از دو
    سکو با هم میانگین گرفته نمی‌شود (قاعده‌ی ۴ قراردادها، بند ۷.۱).

    این enum تک‌عضوی عمداً باقی مانده: ستون `side` کلید طبیعی
    `hourly_rollups` است و حذفش مهاجرتی بی‌دلیل بود (سند تصمیم ۰۰۰۲).
    """

    PRICE = "PRICE"


class Instrument(StrEnum):
    GOLD_18K = "GOLD_18K"
    ABSHODE_MITHQAL = "ABSHODE_MITHQAL"
    SILVER_990 = "SILVER_990"
    XAU = "XAU"


class FeeSource(StrEnum):
    """منشأ دو عدد کارمزد — روی سایت برچسب دارد و ادعای متفاوتی می‌کند.

    - `API`: خود سکو کارمزدش را در API منتشر کرده (وال‌گلد، طلاسی).
    - `MANUAL`: از سند سکو خوانده و دستی ثبت شده، با تاریخ مشاهده (میلی،
      داریک).
    - `IMPLIED`: سکو کارمزدی اعلام نکرده و ما از فاصله‌ی دو عدد منتشرشده‌اش
      برآورد کرده‌ایم، با فرض تقارن (تکنوگلد، طلاین، اکوگلد، زرافزا، بازر).
      **ادعایی درباره‌ی درآمد آن سکو نیست** و هرگز زیر برچسب «از API سکو»
      نمی‌رود (CONTEXT.md، «کارمزد استنتاجی»).
    - `UNKNOWN`: نه در API هست نه جایی منتشر شده (ملی‌گلد، دیجی‌کالا،
      همراه‌گلد، اینوی): هر دو کارمزد تهی می‌مانند و **جعل نمی‌شوند** —
      «یک ردیف صادقانه با نامشخص بهتر از عدد ساختگی»، و صفرِ ساختگی هم جعل
      است.
    """

    API = "API"
    MANUAL = "MANUAL"
    IMPLIED = "IMPLIED"
    UNKNOWN = "UNKNOWN"


class DataPolicy(StrEnum):
    """کلید حقوقی هر سکو — بند ۲.۲ سند معماری. تغییرش دیپلوی نمی‌خواهد."""

    ALLOWED = "ALLOWED"
    RESTRICTED = "RESTRICTED"
    PERMISSION_PENDING = "PERMISSION_PENDING"
    BLOCKED = "BLOCKED"


class MarketModel(StrEnum):
    """مدل معاملاتی سکو — بند ۹.۲ نکته‌ی ۵ سند معماری.

    داریک دفتر سفارش است نه OTC: قیمتش از سفارش‌های کاربران دیگر می‌آید و
    فاصله‌ی دو سرِ دفترش کارمزد کسی نیست ⟸ لایه‌ی وب با همین فیلد برچسب
    «دفتر سفارش» می‌زند (CONTEXT.md، «دفتر سفارش»). بقیه‌ی سکوها OTC اند.
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
    # ترتیب فقط از قیمت می‌آید؛ تستش در مرز وب است.
    referral_param: str | None = None

    @property
    def is_listed(self) -> bool:
        """نمایش عمومی فقط تابع data_policy است (بند ۱۳، تصمیم ۲۰)."""
        return self.data_policy == DataPolicy.ALLOWED


class Quote(BaseModel):
    """«قیمت» یک سکو برای یک دارایی، همیشه تومان بر گرم و پیش از کارمزد.

    هیچ کارمزدی در `price_toman` نرفته است — کارمزدها در `PlatformTerms`
    جدا ثبت می‌شوند (CONTEXT.md، «کارمزد خرید»/«کارمزد فروش»).
    """

    model_config = ConfigDict(frozen=True)

    platform_slug: str
    instrument: Instrument
    side: Side = Side.PRICE
    price_toman: int
    raw_value: Decimal
    raw_scale: Decimal
    fetched_at: datetime


class PlatformTerms(BaseModel):
    """شرایط تجاری سکو — چرخه‌ی عمر جدا از قیمت (کارمزد شاید ماهی یک‌بار عوض شود).

    کارمزدها فقط با `fee_source = UNKNOWN` تهی‌اند؛ در آن حالت هر سه تهی‌اند
    — عدد نصفه‌نیمه یعنی باگ، نه داده. صفر عددِ معتبری است (داریک) و با تهی
    یکی نیست: «صفر» یعنی می‌دانیم کارمزدی نیست، «تهی» یعنی نمی‌دانیم.
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
            raise ValueError("کارمزد API/MANUAL/IMPLIED باید هر سه عدد را داشته باشد")
        return self


class PlatformSnapshot(BaseModel):
    """خروجی یک نوبت گردآوری موفق برای یک سکو: قیمت‌ها + شرایط.

    `suppressed=True` یعنی چک میانه‌ی تقاطعی (قاعده‌ی ۳ قراردادها) این نوبت را
    رد کرده: در استور قیمت جاری منتشر نمی‌شود، فقط در تاریخچه با همین پرچم
    ثبت می‌ماند.

    هر دارایی **دقیقاً یک** سطر قیمت دارد — این تمام مدل تازه است (سند تصمیم
    ۰۰۰۲). سکویی که در یک نوبت قیمت ندارد (دفتر سفارشِ یک‌سمته) اصلاً
    اسنپ‌شات تولید نمی‌کند و آخرین عدد سالمش کهنه می‌شود (قاعده‌ی سخت ۵).
    """

    model_config = ConfigDict(frozen=True)

    platform_slug: str
    quotes: tuple[Quote, ...]
    terms: PlatformTerms
    fetched_at: datetime
    suppressed: bool = False

    @model_validator(mode="after")
    def _one_price_per_instrument(self) -> PlatformSnapshot:
        """دو سطر برای یک دارایی یعنی باگ — مدل تازه فقط یک قیمت می‌شناسد.

        این چک جای همه‌ی قواعد مرزیِ مدل قبلی را می‌گیرد (سطر MEAN غایب،
        «قیمت مؤثر بی‌کارمزد جعل نشود»، «فقط یک سطر یک‌طرفه‌ی دفتر سفارش») —
        وقتی هر سکو یک عدد دارد، هیچ‌کدام از آن حالت‌ها اصلاً ساختنی نیستند.
        """
        seen = [quote.instrument for quote in self.quotes]
        if len(seen) != len(set(seen)):
            raise ValueError(f"{self.platform_slug}: هر دارایی فقط یک سطر قیمت دارد")
        return self
