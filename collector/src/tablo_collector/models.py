from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, model_validator


class Side(StrEnum):
    PRICE = "PRICE"


class Instrument(StrEnum):
    GOLD_18K = "GOLD_18K"
    ABSHODE_MITHQAL = "ABSHODE_MITHQAL"
    SILVER_990 = "SILVER_990"
    XAU = "XAU"


class FeeSource(StrEnum):
    API = "API"
    MANUAL = "MANUAL"
    IMPLIED = "IMPLIED"
    UNKNOWN = "UNKNOWN"


class DataPolicy(StrEnum):
    ALLOWED = "ALLOWED"
    RESTRICTED = "RESTRICTED"
    PERMISSION_PENDING = "PERMISSION_PENDING"
    BLOCKED = "BLOCKED"


class MarketModel(StrEnum):
    OTC = "OTC"
    ORDER_BOOK = "ORDER_BOOK"


class PaymentMethod(StrEnum):
    GATEWAY = "GATEWAY"
    CARD_TO_CARD = "CARD_TO_CARD"
    DIRECT_DEBIT = "DIRECT_DEBIT"
    WALLET = "WALLET"
    IBAN_TRANSFER = "IBAN_TRANSFER"


class KycLevel(StrEnum):
    NONE = "NONE"
    BASIC = "BASIC"
    FULL = "FULL"


class MobileApp(StrEnum):
    WEB_ONLY = "WEB_ONLY"
    ANDROID = "ANDROID"
    IOS = "IOS"
    BOTH = "BOTH"


class FaqItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    question_fa: str
    answer_fa: str


class PlatformProfile(BaseModel):
    model_config = ConfigDict(frozen=True)

    payment_methods: tuple[PaymentMethod, ...] = ()
    kyc_level: KycLevel | None = None
    mobile_app: MobileApp | None = None
    delivery_cost_fa: str | None = None
    min_buy_toman: int | None = None
    min_sell_toman: int | None = None
    pros_fa: tuple[str, ...] = ()
    cons_fa: tuple[str, ...] = ()
    faq: tuple[FaqItem, ...] = ()

    @property
    def is_empty(self) -> bool:
        return self == PlatformProfile()


class Platform(BaseModel):
    model_config = ConfigDict(frozen=True)

    slug: str
    name_fa: str
    data_policy: DataPolicy
    market_model: MarketModel = MarketModel.OTC
    name_en: str | None = None
    website_url: str | None = None
    legal_entity: str | None = None
    founded_year_jalali: int | None = None
    delivery_note_fa: str | None = None
    # ⚠️ `profile` is never written here in `platforms.py` — it is merged in
    # from `platform_profiles` by the settings sync. A value hard-coded into
    # the registry tuple would be silently overwritten on the next sync round.
    profile: PlatformProfile | None = None
    referral_url: str | None = None
    # ⚠️ These two fields are never inputs to sorting or display order —
    # order comes only from price.
    referral_param: str | None = None

    @property
    def is_listed(self) -> bool:
        return self.data_policy == DataPolicy.ALLOWED


class Quote(BaseModel):
    model_config = ConfigDict(frozen=True)

    platform_slug: str
    instrument: Instrument
    side: Side = Side.PRICE
    price_toman: int
    raw_value: Decimal
    raw_scale: Decimal
    fetched_at: datetime


class PlatformTerms(BaseModel):
    model_config = ConfigDict(frozen=True)

    platform_slug: str
    buy_fee_percent: Decimal | None
    sell_fee_percent: Decimal | None
    round_trip_percent: Decimal | None
    fee_source: FeeSource
    buy_enabled: bool
    sell_enabled: bool
    observed_at: datetime

    @model_validator(mode="after")
    def _fees_match_source(self) -> PlatformTerms:
        fees = (self.buy_fee_percent, self.sell_fee_percent, self.round_trip_percent)
        if self.fee_source is FeeSource.UNKNOWN:
            if any(fee is not None for fee in fees):
                raise ValueError("UNKNOWN fee must not have a number — fabricated numbers are forbidden")
        elif any(fee is None for fee in fees):
            raise ValueError("API/MANUAL/IMPLIED fee must have all three numbers")
        return self


class PlatformSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    platform_slug: str
    quotes: tuple[Quote, ...]
    terms: PlatformTerms
    fetched_at: datetime
    suppressed: bool = False

    @model_validator(mode="after")
    def _one_price_per_instrument(self) -> PlatformSnapshot:
        seen = [quote.instrument for quote in self.quotes]
        if len(seen) != len(set(seen)):
            raise ValueError(f"{self.platform_slug}: each instrument has only one price row")
        return self
