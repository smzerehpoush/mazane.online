from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict

from .models import Platform

_COLOR_RE = re.compile(r"^#[0-9a-f]{6}$", re.IGNORECASE)


class PlatformSettingRow(BaseModel):

    model_config = ConfigDict(frozen=True)

    slug: str
    in_chart: bool
    chart_color: str | None
    chart_order: int | None
    referral_url: str | None
    updated_at: datetime


class ChartConfigEntry(BaseModel):

    model_config = ConfigDict(frozen=True)

    slug: str
    name_fa: str
    color: str
    order: int


class SettingsGateway(Protocol):

    async def list_platform_settings(self) -> tuple[PlatformSettingRow, ...]:
        ...


_SELECT_SETTINGS = """
select slug, in_chart, chart_color, chart_order, referral_url, updated_at
from platform_settings
"""


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
