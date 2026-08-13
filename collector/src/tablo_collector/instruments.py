from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from pydantic import BaseModel, ConfigDict

from .models import Instrument, Platform

PUBLISH_GATE_MIN_PLATFORMS = 2


class InstrumentInfo(BaseModel):
    model_config = ConfigDict(frozen=True)

    instrument: Instrument
    slug: str
    name_fa: str
    unit_fa: str
    purity: str | None
    currency: str


INSTRUMENTS: tuple[InstrumentInfo, ...] = (
    InstrumentInfo(
        instrument=Instrument.GOLD_18K,
        slug="tala-18",
        name_fa="طلای ۱۸ عیار",
        unit_fa="گرم",
        purity="750",
        currency="TOMAN",
    ),
    InstrumentInfo(
        instrument=Instrument.ABSHODE_MITHQAL,
        slug="abshode",
        name_fa="طلای آب‌شده (مظنه)",
        unit_fa="مثقال",
        purity=None,
        currency="TOMAN",
    ),
    InstrumentInfo(
        instrument=Instrument.SILVER_990,
        slug="noghre",
        name_fa="نقره‌ی ۹۹۰",
        unit_fa="گرم",
        purity="990",
        currency="TOMAN",
    ),
    InstrumentInfo(
        instrument=Instrument.XAU,
        slug="ons-jahani",
        name_fa="انس جهانی طلا",
        unit_fa="اونس",
        purity=None,
        currency="USD",
    ),
)


class InstrumentListing(BaseModel):
    model_config = ConfigDict(frozen=True)

    slug: str
    instrument: Instrument
    name_fa: str
    unit_fa: str
    purity: str | None
    currency: str
    supporting_platform_slugs: tuple[str, ...]
    published: bool


class _EmitsInstruments(Protocol):
    slug: str
    instruments: tuple[Instrument, ...]


def build_listings(
    adapters: Sequence[_EmitsInstruments], platforms: Sequence[Platform]
) -> tuple[InstrumentListing, ...]:
    emitted_by = {adapter.slug: tuple(adapter.instruments) for adapter in adapters}
    listings = []
    for info in INSTRUMENTS:
        supporting = tuple(
            platform.slug
            for platform in platforms
            if platform.is_listed and info.instrument in emitted_by.get(platform.slug, ())
        )
        listings.append(
            InstrumentListing(
                slug=info.slug,
                instrument=info.instrument,
                name_fa=info.name_fa,
                unit_fa=info.unit_fa,
                purity=info.purity,
                currency=info.currency,
                supporting_platform_slugs=supporting,
                published=len(supporting) >= PUBLISH_GATE_MIN_PLATFORMS,
            )
        )
    return tuple(listings)
