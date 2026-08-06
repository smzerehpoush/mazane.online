"""مدل‌های داده — بند ۲.۲ سند معماری.

`raw_value` و `raw_scale` همیشه ذخیره می‌شوند تا اگر روزی ضریب منبعی اشتباه
از آب درآمد، تاریخچه قابل بازسازی باشد. `fee_source` تفکیک می‌کند که کارمزد
از API آمده یا دستی ثبت شده است.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, computed_field, model_validator

from .pricing import reference_price_toman


class Side(StrEnum):
    BUY = "BUY"
    SELL = "SELL"
    MID = "MID"


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


class PlatformSnapshot(BaseModel):
    """خروجی یک نوبت گردآوری موفق برای یک سکو: قیمت‌ها + شرایط.

    `suppressed=True` یعنی چک میانه‌ی تقاطعی (قاعده‌ی ۳ قراردادها) این نوبت را
    رد کرده: در استور قیمت جاری منتشر نمی‌شود، فقط در تاریخچه با همین پرچم
    ثبت می‌ماند.
    """

    model_config = ConfigDict(frozen=True)

    platform_slug: str
    quotes: tuple[Quote, ...]
    terms: PlatformTerms
    fetched_at: datetime
    suppressed: bool = False

    @computed_field  # type: ignore[prop-decorator]
    @property
    def reference_prices_toman(self) -> dict[str, int]:
        """قیمت مرجع این سکو به‌ازای هر دارایی = میانگین مؤثر خرید و فروش
        **خودش** (بند ۱۳، تصمیم ۱۹) — computed_field است تا در JSON کانونی
        (همان که ردیس/وب می‌خوانند) همیشه حاضر باشد و فرمول فقط همین‌جا،
        در گردآورنده، زندگی کند (قاعده‌ی ۱ قراردادها).

        فقط دارایی‌هایی که هر دو سمت BUY و SELL دارند کلید می‌گیرند: کارمزد
        نامعلوم (فقط MID) یا دفتر یک‌طرفه ⟸ غایب، جعل نمی‌شود. MID هرگز در
        این میانگین دخالت ندارد و هیچ عدد بین‌سکویی‌ای اینجا وجود ندارد.
        """
        buys = {q.instrument.value: q.price_toman for q in self.quotes if q.side is Side.BUY}
        sells = {q.instrument.value: q.price_toman for q in self.quotes if q.side is Side.SELL}
        return {
            instrument: reference_price_toman(buys[instrument], sells[instrument])
            for instrument in buys
            if instrument in sells
        }

    @model_validator(mode="after")
    def _no_effective_price_without_fee(self) -> PlatformSnapshot:
        """کارمزد نامعلوم ⟸ قیمت مؤثر BUY/SELL **جعل نمی‌شود**.

        جعل یعنی mid×(1±f) با f نامعلوم؛ پس با UNKNOWN دو شکل صادقانه مجاز
        است: فقط MID (سکوی تک‌قیمتی)، یا **یک** سطر یک‌طرفه‌ی خودِ منبع —
        دفتر سفارش داریک وقتی یک سمتش تهی است (بند ۹.۲ نکته‌ی ۵): قیمتِ
        سمتِ موجود عین سفارشِ سرِ دفتر است، نه مشتق از کارمزد.
        """
        if self.terms.fee_source is not FeeSource.UNKNOWN:
            return self
        sides = [quote for quote in self.quotes if quote.side is not Side.MID]
        if not sides:
            return self
        if any(quote.side is Side.MID for quote in self.quotes):
            raise ValueError("با کارمزد UNKNOWN سطر BUY/SELL کنار MID یعنی قیمت جعلی")
        if len(sides) > 1:
            raise ValueError("با کارمزد UNKNOWN فقط یک سطر یک‌طرفه‌ی دفتر سفارش مجاز است")
        return self
