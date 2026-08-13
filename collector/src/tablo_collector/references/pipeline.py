from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Protocol

from ..store import Store
from . import ReferenceSnapshot
from .talair import TalairReference
from .transport import ReferenceTransport

log = logging.getLogger("mazane.collector.references")


class ReferenceSource(Protocol):
    slug: str

    async def collect(
        self, transport: ReferenceTransport, fetched_at: datetime
    ) -> ReferenceSnapshot: ...


REFERENCE_SOURCES: tuple[ReferenceSource, ...] = (TalairReference(),)


async def collect_reference_round(
    sources: Sequence[ReferenceSource],
    transport: ReferenceTransport,
    store: Store,
    *,
    now: datetime | None = None,
) -> tuple[ReferenceSnapshot, ...]:
    fetched_at = now if now is not None else datetime.now(UTC)

    saved: list[ReferenceSnapshot] = []
    for source in sources:
        try:
            snapshot = await source.collect(transport, fetched_at)
        except Exception:
            log.exception("گردآوری مرجع %s شکست خورد — مرجع کهنه می‌ماند", source.slug)
            continue
        await store.save_reference(snapshot)
        saved.append(snapshot)
    return tuple(saved)
