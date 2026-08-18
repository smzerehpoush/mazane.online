from __future__ import annotations

import json
import re
from collections.abc import Sequence
from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict

from .models import (
    FaqItem,
    KycLevel,
    MobileApp,
    PaymentMethod,
    Platform,
    PlatformProfile,
)

_COLOR_RE = re.compile(r"^#[0-9a-f]{6}$", re.IGNORECASE)


class PlatformSettingRow(BaseModel):

    model_config = ConfigDict(frozen=True)

    slug: str
    in_chart: bool
    chart_color: str | None
    chart_order: int | None
    referral_url: str | None
    updated_at: datetime


class PlatformProfileRow(BaseModel):

    model_config = ConfigDict(frozen=True)

    slug: str
    payment_methods: tuple[PaymentMethod, ...] = ()
    kyc_level: KycLevel | None = None
    mobile_app: MobileApp | None = None
    delivery_cost_fa: str | None = None
    min_buy_toman: int | None = None
    min_sell_toman: int | None = None
    pros_fa: tuple[str, ...] = ()
    cons_fa: tuple[str, ...] = ()
    faq: tuple[FaqItem, ...] = ()

    def as_profile(self) -> PlatformProfile:
        return PlatformProfile(
            payment_methods=self.payment_methods,
            kyc_level=self.kyc_level,
            mobile_app=self.mobile_app,
            delivery_cost_fa=self.delivery_cost_fa,
            min_buy_toman=self.min_buy_toman,
            min_sell_toman=self.min_sell_toman,
            pros_fa=self.pros_fa,
            cons_fa=self.cons_fa,
            faq=self.faq,
        )


class ChartConfigEntry(BaseModel):

    model_config = ConfigDict(frozen=True)

    slug: str
    name_fa: str
    color: str
    order: int


class SettingsGateway(Protocol):

    async def list_platform_settings(self) -> tuple[PlatformSettingRow, ...]:
        ...

    async def list_platform_profiles(self) -> tuple[PlatformProfileRow, ...]:
        ...


_SELECT_SETTINGS = """
select slug, in_chart, chart_color, chart_order, referral_url, updated_at
from platform_settings
"""

_SELECT_PROFILES = """
select slug, payment_methods, kyc_level, mobile_app, delivery_cost_fa,
       min_buy_toman, min_sell_toman, pros_fa, cons_fa, faq
from platform_profiles
"""


def _faq_items(raw: Any) -> tuple[FaqItem, ...]:
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, list):
        return ()
    return tuple(
        FaqItem(question_fa=item["question_fa"], answer_fa=item["answer_fa"])
        for item in raw
        if isinstance(item, dict) and item.get("question_fa") and item.get("answer_fa")
    )


class PostgresSettingsGateway:
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def list_platform_settings(self) -> tuple[PlatformSettingRow, ...]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(_SELECT_SETTINGS)
        return tuple(
            PlatformSettingRow(
                slug=row["slug"],
                in_chart=row["in_chart"],
                chart_color=row["chart_color"],
                chart_order=row["chart_order"],
                referral_url=row["referral_url"],
                updated_at=row["updated_at"],
            )
            for row in rows
        )

    async def list_platform_profiles(self) -> tuple[PlatformProfileRow, ...]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(_SELECT_PROFILES)
        return tuple(
            PlatformProfileRow(
                slug=row["slug"],
                payment_methods=tuple(row["payment_methods"] or ()),
                kyc_level=row["kyc_level"],
                mobile_app=row["mobile_app"],
                delivery_cost_fa=row["delivery_cost_fa"],
                min_buy_toman=row["min_buy_toman"],
                min_sell_toman=row["min_sell_toman"],
                pros_fa=tuple(row["pros_fa"] or ()),
                cons_fa=tuple(row["cons_fa"] or ()),
                faq=_faq_items(row["faq"]),
            )
            for row in rows
        )


def chart_config_from_settings(
    rows: Sequence[PlatformSettingRow],
    listed_platforms: Sequence[Platform],
) -> tuple[ChartConfigEntry, ...]:
    listed_by_slug = {p.slug: p for p in listed_platforms}

    def is_eligible(row: PlatformSettingRow) -> bool:
        return (
            row.in_chart
            and row.chart_color is not None
            and _COLOR_RE.match(row.chart_color) is not None
            and row.slug in listed_by_slug
        )

    candidates = [row for row in rows if is_eligible(row)]
    candidates.sort(
        key=lambda row: (
            row.chart_order if row.chart_order is not None else 2**31,
            row.slug,
        )
    )

    entries: list[ChartConfigEntry] = []
    for i, row in enumerate(candidates):
        assert row.chart_color is not None
        entries.append(
            ChartConfigEntry(
                slug=row.slug,
                name_fa=listed_by_slug[row.slug].name_fa,
                color=row.chart_color.lower(),
                order=i,
            )
        )
    return tuple(entries)


def platforms_with_referral_overrides(
    rows: Sequence[PlatformSettingRow],
    platforms: Sequence[Platform],
) -> tuple[Platform, ...]:
    overrides = {row.slug: row.referral_url for row in rows if row.referral_url}
    if not overrides:
        return tuple(platforms)
    return tuple(
        p.model_copy(update={"referral_url": overrides[p.slug]}) if p.slug in overrides else p
        for p in platforms
    )


def platforms_with_profiles(
    rows: Sequence[PlatformProfileRow],
    platforms: Sequence[Platform],
) -> tuple[Platform, ...]:
    profiles = {
        row.slug: profile
        for row in rows
        if not (profile := row.as_profile()).is_empty
    }
    if not profiles:
        return tuple(platforms)
    return tuple(
        p.model_copy(update={"profile": profiles[p.slug]}) if p.slug in profiles else p
        for p in platforms
    )
